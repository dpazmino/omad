import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { BMAD_AGENTS, buildSystemPrompt } from "./agents";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const H = `^#+\\s+(?:[^\\n]*?\\s)?`;
const DOCUMENT_PATTERNS: { pattern: RegExp; docType: string; title: string }[] = [
  { pattern: new RegExp(`${H}product\\s+brief`, "im"), docType: "product-brief", title: "Product Brief" },
  { pattern: new RegExp(`${H}project\\s+brief`, "im"), docType: "product-brief", title: "Project Brief" },
  { pattern: new RegExp(`${H}[\\w\\s]*brief\\s*(—|–|-)`, "im"), docType: "product-brief", title: "Product Brief" },
  { pattern: new RegExp(`${H}market\\s+research`, "im"), docType: "market-research", title: "Market Research" },
  { pattern: new RegExp(`${H}competitive\\s+analysis`, "im"), docType: "market-research", title: "Competitive Analysis" },
  { pattern: new RegExp(`${H}brainstorm`, "im"), docType: "brainstorm", title: "Brainstorm Summary" },
  { pattern: new RegExp(`${H}product\\s+requirements?\\s+document`, "im"), docType: "prd", title: "Product Requirements Document" },
  { pattern: /^#+\s+(?:[^\n]*?\s)?PRD/m, docType: "prd", title: "Product Requirements Document" },
  { pattern: new RegExp(`${H}ux\\s+design`, "im"), docType: "ux-design", title: "UX Design" },
  { pattern: new RegExp(`${H}ux\\s+spec`, "im"), docType: "ux-design", title: "UX Specification" },
  { pattern: new RegExp(`${H}user\\s+experience`, "im"), docType: "ux-design", title: "UX Design" },
  { pattern: new RegExp(`${H}(?:technical\\s+|system\\s+)?architecture`, "im"), docType: "architecture", title: "Architecture Document" },
  { pattern: new RegExp(`${H}epic`, "im"), docType: "epic", title: "Epic" },
  { pattern: new RegExp(`${H}user\\s+stor`, "im"), docType: "stories", title: "User Stories" },
  { pattern: new RegExp(`${H}sprint\\s+plan`, "im"), docType: "sprint-plan", title: "Sprint Plan" },
  { pattern: new RegExp(`${H}implementation\\s+plan`, "im"), docType: "implementation-plan", title: "Implementation Plan" },
  { pattern: new RegExp(`${H}code\\s+review`, "im"), docType: "code-review", title: "Code Review" },
  { pattern: new RegExp(`${H}qa\\s+report`, "im"), docType: "qa-report", title: "QA Report" },
  { pattern: new RegExp(`${H}test\\s+plan`, "im"), docType: "test-plan", title: "Test Plan" },
];

async function detectAndSaveDocument(
  content: string,
  projectId: number | null,
  sessionId: number,
  messageId: number,
  agentName: string | null,
  phase: string
) {
  if (!projectId || content.length < 200) return;

  for (const { pattern, docType, title } of DOCUMENT_PATTERNS) {
    if (pattern.test(content)) {
      const existing = await storage.getDocumentsByProject(projectId);
      const duplicate = existing.find(d => d.docType === docType && d.sessionId === sessionId);
      if (duplicate) {
        await storage.updateDocument(duplicate.id, { content, messageId });
        console.log(`Updated document: ${title} (project ${projectId})`);
      } else {
        const headerMatch = content.match(/^#\s+(.+)/m);
        const docTitle = headerMatch ? headerMatch[1].trim() : title;
        await storage.createDocument({
          projectId,
          sessionId,
          messageId,
          title: docTitle,
          docType,
          content,
          agentName,
          phase,
        });
        console.log(`Auto-saved document: ${docTitle} (project ${projectId})`);
      }
      return;
    }
  }
}

async function seedAgents() {
  const existing = await storage.getAgents();
  if (existing.length === 0) {
    for (const agent of BMAD_AGENTS) {
      await storage.createAgent(agent);
    }
    console.log(`Seeded ${BMAD_AGENTS.length} BMad agents`);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedAgents();

  // ── Agents ──
  app.get("/api/agents", async (_req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.get("/api/agents/:id", async (req, res) => {
    const agent = await storage.getAgent(parseInt(req.params.id));
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  });

  app.patch("/api/agents/:id", async (req, res) => {
    const updated = await storage.updateAgent(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  // ── Sessions ──
  app.get("/api/sessions", async (req, res) => {
    const allSessions = await storage.getSessions();
    const globalOnly = allSessions.filter(s => !s.projectId);
    res.json(globalOnly);
  });

  app.get("/api/sessions/:id", async (req, res) => {
    const session = await storage.getSession(parseInt(req.params.id));
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    const agents = await storage.getAgents();
    const defaultAgent = agents.find(a => a.isDefault) || agents[0];
    const session = await storage.createSession({
      title: req.body.title || "New Session",
      projectId: req.body.projectId || null,
      activeAgentId: defaultAgent?.id || null,
      partyMode: false,
    });
    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const updated = await storage.updateSession(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    await storage.deleteSession(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Messages ──
  app.get("/api/sessions/:id/messages", async (req, res) => {
    const msgs = await storage.getMessages(parseInt(req.params.id));
    res.json(msgs);
  });

  // ── Chat (Streaming) ──
  app.post("/api/sessions/:id/chat", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { content, agentId } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      const targetAgentId = agentId || session.activeAgentId;
      const agent = targetAgentId ? await storage.getAgent(targetAgentId) : null;
      
      if (!agent) return res.status(400).json({ error: "No agent selected for this session" });

      // Save user message
      const userMsg = await storage.createMessage({
        sessionId,
        role: "user",
        content,
        agentId: null,
        agentName: null,
      });

      const history = await storage.getMessages(sessionId);
      const systemPrompt = buildSystemPrompt(agent, session.partyMode);
      const chatMessages: { role: "user" | "assistant"; content: string }[] = history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_message", message: userMsg })}\n\n`);

      let fullResponse = "";
      let stream;
      try {
        stream = anthropic.messages.stream({
          model: agent.model || "claude-sonnet-4-6",
          max_tokens: 8192,
          temperature: 0.1,
          system: systemPrompt,
          messages: chatMessages,
        });
      } catch (apiError: any) {
        console.error("Anthropic API error:", apiError?.message || apiError);
        res.write(`data: ${JSON.stringify({ type: "error", error: `AI service error: ${apiError?.message || "Unknown error"}` })}\n\n`);
        res.end();
        return;
      }

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const delta = event.delta.text;
          if (delta) {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ type: "content", content: delta })}\n\n`);
          }
        }
      }

      // Save assistant message
      const assistantMsg = await storage.createMessage({
        sessionId,
        role: "assistant",
        content: fullResponse,
        agentId: agent.id,
        agentName: `${agent.name} (${agent.title})`,
      });

      // Update session title from first message if still default
      if (session.title === "New Session" && history.length <= 1) {
        const titleContent = content.slice(0, 50);
        await storage.updateSession(sessionId, { title: titleContent });
      }

      const project = session.projectId ? await storage.getProject(session.projectId) : null;
      detectAndSaveDocument(
        fullResponse, session.projectId, sessionId, assistantMsg.id,
        `${agent.name} (${agent.title})`, project?.phase || "analysis"
      ).catch(err => console.error("Document detection error:", err));

      res.write(`data: ${JSON.stringify({ type: "done", message: assistantMsg })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // ── Party Mode Chat (multiple agents respond) ──
  app.post("/api/sessions/:id/party-chat", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Save user message
      const userMsg = await storage.createMessage({
        sessionId,
        role: "user",
        content,
        agentId: null,
        agentName: null,
      });

      const allAgents = await storage.getAgents();
      const activeAgents = allAgents.filter(a => a.status === "active");
      const partyAgents = activeAgents;

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_message", message: userMsg })}\n\n`);

      const history = await storage.getMessages(sessionId);
      const baseHistory = history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.agentName ? `[${m.agentName}]: ${m.content}` : m.content,
      }));

      // Each agent responds sequentially in party mode
      for (const agent of partyAgents) {
        res.write(`data: ${JSON.stringify({ type: "agent_start", agentId: agent.id, agentName: `${agent.name} (${agent.title})` })}\n\n`);

        const partySystemPrompt = buildSystemPrompt(agent, true);

        let agentStream;
        try {
          agentStream = anthropic.messages.stream({
            model: agent.model || "claude-sonnet-4-6",
            max_tokens: 8192,
            temperature: 0.1,
            system: partySystemPrompt,
            messages: baseHistory,
          });
        } catch (apiError: any) {
          console.error(`Party mode Anthropic error for ${agent.name}:`, apiError?.message);
          res.write(`data: ${JSON.stringify({ type: "content", content: `[Error: AI model could not respond — ${apiError?.message || "internal error"}]`, agentId: agent.id })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: agent.id })}\n\n`);
          continue;
        }

        let agentResponse = "";

        for await (const event of agentStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const delta = event.delta.text;
            if (delta) {
              agentResponse += delta;
              res.write(`data: ${JSON.stringify({ type: "content", content: delta, agentId: agent.id })}\n\n`);
            }
          }
        }

        const assistantMsg = await storage.createMessage({
          sessionId,
          role: "assistant",
          content: agentResponse,
          agentId: agent.id,
          agentName: `${agent.name} (${agent.title})`,
        });

        const partyProject = session.projectId ? await storage.getProject(session.projectId) : null;
        detectAndSaveDocument(
          agentResponse, session.projectId, sessionId, assistantMsg.id,
          `${agent.name} (${agent.title})`, partyProject?.phase || "analysis"
        ).catch(err => console.error("Document detection error (party):", err));

        res.write(`data: ${JSON.stringify({ type: "agent_done", agentId: agent.id, message: assistantMsg })}\n\n`);

        // Add this agent's response to history for next agent
        baseHistory.push({
          role: "assistant",
          content: `[${agent.name} (${agent.title})]: ${agentResponse}`,
        });
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Party chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // ── BMad Help ──
  app.get("/api/bmad-help", async (_req, res) => {
    const agents = await storage.getAgents();
    const help = {
      overview: "The BMad Method is an AI-driven agile development framework with specialized agents that guide you through the full software lifecycle.",
      phases: [
        { name: "1. Analysis", description: "Research, brainstorm, and define your product brief", agents: ["Business Analyst"] },
        { name: "2. Planning", description: "Create PRD, UX design, and stakeholder alignment", agents: ["Product Manager", "UX Designer"] },
        { name: "3. Solutioning", description: "Architecture, epics & stories, implementation readiness", agents: ["Lead Architect", "Product Manager"] },
        { name: "4. Implementation", description: "Sprint planning, development, code review, QA", agents: ["Scrum Master", "Developer", "QA Engineer"] },
      ],
      agents: agents.map(a => ({
        name: a.name,
        title: a.title,
        icon: a.icon,
        capabilities: a.capabilities,
        commands: a.menuCommands,
      })),
      tips: [
        "Switch agents using the agent selector to get domain-specific expertise",
        "Enable Party Mode to have multiple agents collaborate on your question",
        "Use agent-specific commands (e.g., CP for Create PRD) to trigger guided workflows",
      ],
    };
    res.json(help);
  });

  // ── Projects ──
  app.get("/api/projects", async (_req, res) => {
    const projectsList = await storage.getProjects();
    res.json(projectsList);
  });

  app.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(parseInt(req.params.id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  app.post("/api/projects", async (req, res) => {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Project name is required" });
    const project = await storage.createProject({
      name: name.trim(),
      description: description || "",
      status: "active",
      phase: "analysis",
    });
    res.status(201).json(project);
  });

  app.patch("/api/projects/:id", async (req, res) => {
    const existing = await storage.getProject(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const updated = await storage.updateProject(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const existing = await storage.getProject(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Project not found" });
    await storage.deleteProject(parseInt(req.params.id));
    res.status(204).send();
  });

  app.get("/api/projects/:id/sessions", async (req, res) => {
    const projectSessions = await storage.getSessionsByProject(parseInt(req.params.id));
    res.json(projectSessions);
  });

  app.get("/api/projects/:id/workflows", async (req, res) => {
    const projectWorkflows = await storage.getWorkflowsByProject(parseInt(req.params.id));
    res.json(projectWorkflows);
  });

  // ── Documents ──
  app.get("/api/projects/:id/documents", async (req, res) => {
    const docs = await storage.getDocumentsByProject(parseInt(req.params.id));
    res.json(docs);
  });

  app.get("/api/documents/:id", async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  });

  app.post("/api/projects/:id/documents", async (req, res) => {
    const project = await storage.getProject(parseInt(req.params.id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    const { title, docType, content, agentName, phase, sessionId, messageId } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: "Title and content are required" });
    const doc = await storage.createDocument({
      projectId: parseInt(req.params.id),
      sessionId: sessionId || null,
      messageId: messageId || null,
      title: title.trim(),
      docType: docType || "general",
      content: content.trim(),
      agentName: agentName || null,
      phase: phase || "analysis",
    });
    res.status(201).json(doc);
  });

  app.patch("/api/documents/:id", async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const updated = await storage.updateDocument(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ error: "Document not found" });
    await storage.deleteDocument(parseInt(req.params.id));
    res.status(204).send();
  });

  app.post("/api/projects/:id/scan-documents", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const projectSessions = await storage.getSessionsByProject(projectId);
    let found = 0;
    for (const session of projectSessions) {
      const msgs = await storage.getMessages(session.id);
      for (const msg of msgs) {
        if (msg.role === "assistant" && msg.content.length >= 200) {
          await detectAndSaveDocument(msg.content, projectId, session.id, msg.id, msg.agentName, project.phase);
          found++;
        }
      }
    }
    const docs = await storage.getDocumentsByProject(projectId);
    res.json({ scanned: found, documents: docs });
  });

  // ── Workflows ──
  app.get("/api/workflows", async (_req, res) => {
    const wfs = await storage.getWorkflows();
    res.json(wfs);
  });

  app.post("/api/workflows", async (req, res) => {
    const workflow = await storage.createWorkflow(req.body);
    res.status(201).json(workflow);
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    const updated = await storage.updateWorkflow(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  // ── Epics ──
  app.get("/api/projects/:id/epics", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const result = await storage.getEpicsByProject(projectId);
    res.json(result);
  });

  app.post("/api/projects/:id/epics", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const epic = await storage.createEpic({ ...req.body, projectId });
    res.status(201).json(epic);
  });

  app.patch("/api/epics/:id", async (req, res) => {
    const updated = await storage.updateEpic(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/epics/:id", async (req, res) => {
    await storage.deleteEpic(parseInt(req.params.id));
    res.status(204).end();
  });

  // ── Sprints ──
  app.get("/api/projects/:id/sprints", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const result = await storage.getSprintsByProject(projectId);
    res.json(result);
  });

  app.post("/api/projects/:id/sprints", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const sprint = await storage.createSprint({ ...req.body, projectId });
    res.status(201).json(sprint);
  });

  app.patch("/api/sprints/:id", async (req, res) => {
    const updated = await storage.updateSprint(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/sprints/:id", async (req, res) => {
    await storage.deleteSprint(parseInt(req.params.id));
    res.status(204).end();
  });

  // ── Stories ──
  app.get("/api/projects/:id/stories", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const result = await storage.getStoriesByProject(projectId);
    res.json(result);
  });

  app.get("/api/epics/:id/stories", async (req, res) => {
    const result = await storage.getStoriesByEpic(parseInt(req.params.id));
    res.json(result);
  });

  app.post("/api/projects/:id/stories", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const story = await storage.createStory({ ...req.body, projectId });
    res.status(201).json(story);
  });

  app.patch("/api/stories/:id", async (req, res) => {
    const updated = await storage.updateStory(parseInt(req.params.id), req.body);
    res.json(updated);
  });

  app.delete("/api/stories/:id", async (req, res) => {
    await storage.deleteStory(parseInt(req.params.id));
    res.status(204).end();
  });

  // ── Import Epics/Stories from Document ──
  app.post("/api/projects/:id/import-epics", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const docs = await storage.getDocumentsByProject(projectId);
    const epicDoc = docs.find(d => d.docType === "epic" || d.docType === "stories");
    if (!epicDoc) return res.status(404).json({ error: "No epic/stories document found. Run CE command first." });

    const parsed = parseEpicsFromDocument(epicDoc.content);
    const created = { epics: 0, stories: 0 };

    for (const ep of parsed) {
      const epic = await storage.createEpic({ projectId, title: ep.title, description: ep.description, status: "backlog", priority: "medium" });
      created.epics++;
      for (const st of ep.stories) {
        await storage.createStory({ epicId: epic.id, projectId, title: st.title, description: st.description, acceptanceCriteria: st.acceptanceCriteria, status: "backlog", priority: st.priority || "medium", storyPoints: st.storyPoints });
        created.stories++;
      }
    }

    res.json({ imported: created, message: `Imported ${created.epics} epics and ${created.stories} stories` });
  });

  return httpServer;
}

function parseEpicsFromDocument(content: string): { title: string; description: string; stories: { title: string; description: string; acceptanceCriteria: string; priority?: string; storyPoints?: number }[] }[] {
  const result: { title: string; description: string; stories: { title: string; description: string; acceptanceCriteria: string; priority?: string; storyPoints?: number }[] }[] = [];
  const lines = content.split("\n");
  let currentEpic: { title: string; description: string; stories: { title: string; description: string; acceptanceCriteria: string; priority?: string; storyPoints?: number }[] } | null = null;
  let currentStory: { title: string; description: string; acceptanceCriteria: string; priority?: string; storyPoints?: number } | null = null;
  let collectingAC = false;
  let acLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const epicMatch = trimmed.match(/^#{1,2}\s+(?:[^a-zA-Z]*\s*)?(?:epic\s*\d*[:\s]*|E\d+\s*[—–\-:]\s*)(.+)/i);
    if (epicMatch && /overview|summary/i.test(epicMatch[1])) continue;
    if (epicMatch) {
      if (currentStory && currentEpic) {
        if (collectingAC) currentStory.acceptanceCriteria = acLines.join("\n");
        currentEpic.stories.push(currentStory);
        currentStory = null;
      }
      if (currentEpic) result.push(currentEpic);
      currentEpic = { title: epicMatch[1].replace(/\*{1,2}/g, "").trim(), description: "", stories: [] };
      collectingAC = false;
      acLines = [];
      continue;
    }

    const storyMatch = trimmed.match(/^#{2,4}\s+(?:[^a-zA-Z]*\s*)?(?:user\s+)?story\s*(?:E?\d+[\-.]?\d*)?[:\s]*(.+)/i);
    if (storyMatch && currentEpic) {
      if (currentStory) {
        if (collectingAC) currentStory.acceptanceCriteria = acLines.join("\n");
        currentEpic.stories.push(currentStory);
      }
      currentStory = { title: storyMatch[1].replace(/\*{1,2}/g, "").trim(), description: "", acceptanceCriteria: "" };
      collectingAC = false;
      acLines = [];
      continue;
    }

    if (trimmed.match(/^(?:\*{0,2})acceptance\s+criteria/i)) {
      collectingAC = true;
      acLines = [];
      continue;
    }

    if (trimmed.match(/^(?:\*{0,2})(?:story\s+)?points?\s*[:\s]*(\d+)/i) && currentStory) {
      const pts = trimmed.match(/(\d+)/);
      if (pts) currentStory.storyPoints = parseInt(pts[1]);
      continue;
    }

    if (trimmed.match(/^(?:\*{0,2})priority\s*[:\s]*(low|medium|high|critical)/i) && currentStory) {
      const p = trimmed.match(/(low|medium|high|critical)/i);
      if (p) currentStory.priority = p[1].toLowerCase();
      continue;
    }

    if (collectingAC && currentStory) {
      if (trimmed.startsWith("#") || (trimmed === "" && acLines.length > 0 && lines[i + 1]?.trim().startsWith("#"))) {
        currentStory.acceptanceCriteria = acLines.join("\n");
        collectingAC = false;
      } else if (trimmed.startsWith("|") || trimmed.match(/^\|?[\s-]+\|/)) {
        continue;
      } else {
        acLines.push(trimmed);
      }
    } else if (currentStory && !collectingAC && trimmed && !trimmed.startsWith("#")) {
      if (trimmed.startsWith("|") || trimmed.match(/^\|?[\s-]+\|/)) continue;
      if (currentStory.description) currentStory.description += "\n" + trimmed;
      else currentStory.description = trimmed;
    } else if (currentEpic && !currentStory && trimmed && !trimmed.startsWith("#")) {
      if (trimmed.startsWith("|") || trimmed.match(/^\|?[\s-]+\|/)) continue;
      if (currentEpic.description) currentEpic.description += "\n" + trimmed;
      else currentEpic.description = trimmed;
    }
  }

  if (currentStory && currentEpic) {
    if (collectingAC) currentStory.acceptanceCriteria = acLines.join("\n");
    currentEpic.stories.push(currentStory);
  }
  if (currentEpic) result.push(currentEpic);

  return result;
}
