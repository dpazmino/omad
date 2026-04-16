import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { BMAD_AGENTS, buildSystemPrompt } from "./agents";
import { parseRepoUrl, fetchRepoSnapshot, buildRepoContextBlock, PrivateRepoError, type RepoSnapshot } from "./github";
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
  } else {
    const existingNames = new Set(existing.map(a => a.name));
    for (const agent of BMAD_AGENTS) {
      if (!existingNames.has(agent.name)) {
        await storage.createAgent(agent);
        console.log(`Seeded new agent: ${agent.name}`);
      }
    }
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
        { name: "4. Refinement", description: "INVEST framework analysis to validate story quality", agents: ["Story Analyst"] },
        { name: "5. Implementation", description: "Sprint planning, development, code review, QA", agents: ["Scrum Master", "Developer", "QA Engineer"] },
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

  // ── INVEST Analysis for a story (Allie) ──
  app.post("/api/stories/:id/invest", async (req, res) => {
    const storyId = parseInt(req.params.id);
    const story = await storage.getStory(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const epic = await storage.getEpic(story.epicId);
    const allStories = await storage.getStoriesByProject(story.projectId);
    const siblingStories = allStories
      .filter(s => s.epicId === story.epicId && s.id !== story.id && !s.mergedIntoStoryId)
      .map(s => `  - [ID:${s.id}] "${s.title}"`)
      .join("\n");

    const systemPrompt = `You are Allie, the Story Analyst specializing in the INVEST framework (Bill Wake).

Evaluate this user story against all six INVEST criteria. Return your analysis as a JSON object (and ONLY a JSON object, no other text) in this exact format:

{
  "independent": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "negotiable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "valuable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "estimable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "small": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "testable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "summary": "One paragraph overall assessment",
  "suggestions": ["Specific improvement 1", "Specific improvement 2"]
}

INVEST criteria:
- **Independent**: Can be developed without depending on other stories. Check for hidden coupling.
- **Negotiable**: Flexible on implementation details. Not over-specified.
- **Valuable**: Delivers clear user/business value. "So that" benefit is explicit.
- **Estimable**: Enough information to estimate. No major unknowns.
- **Small**: Completable in one sprint. Should be split if too large.
- **Testable**: Clear acceptance criteria that can be verified.

Score meanings:
- "pass": Fully meets the criterion
- "warn": Partially meets, minor improvements needed
- "fail": Does not meet, significant rework needed`;

    const userMessage = `Evaluate this story:

**Title:** ${story.title}
**Epic:** ${epic?.title || "Unknown"}
**Description:** ${story.description || "(none)"}
**Acceptance Criteria:** ${story.acceptanceCriteria || "(none)"}
**Priority:** ${story.priority}
**Story Points:** ${story.storyPoints || "Not estimated"}
${story.dependsOn && story.dependsOn.length > 0 ? `**Dependencies:** ${story.dependsOn.join(", ")}` : ""}

**Other stories in the same epic:**
${siblingStories || "(none)"}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: "Failed to parse INVEST analysis" });
      }

      const analysis = JSON.parse(jsonMatch[0]);
      await storage.updateStory(storyId, { investAnalysis: analysis });
      res.json({ analysis });
    } catch (error: any) {
      console.error("INVEST analysis error:", error);
      res.status(500).json({ error: error.message || "INVEST analysis failed" });
    }
  });

  // ── Apply INVEST suggestions and re-analyze ──
  app.post("/api/stories/:id/invest-apply", async (req, res) => {
    const storyId = parseInt(req.params.id);
    const story = await storage.getStory(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const currentAnalysis = story.investAnalysis as any;
    if (!currentAnalysis?.suggestions || currentAnalysis.suggestions.length === 0) {
      return res.status(400).json({ error: "No suggestions to apply" });
    }

    const epic = await storage.getEpic(story.epicId);

    const rewritePrompt = `You are Allie, the Story Analyst specializing in the INVEST framework.

You previously analyzed this user story and found issues. Now apply the suggestions to improve it.

Return ONLY a JSON object with the improved story fields:
{
  "title": "Improved title (or same if fine)",
  "description": "Improved description incorporating the suggestions",
  "acceptanceCriteria": "Improved acceptance criteria that are specific and testable"
}

Rules:
- Apply ALL suggestions listed below
- Make the story follow the INVEST framework (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- Keep the core intent of the story — improve quality, don't change the goal
- Use "As a [role], I want [action] so that [benefit]" format for the description if not already
- Make acceptance criteria specific, measurable, and testable (use Given/When/Then or bullet points)
- Return ONLY the JSON object, no other text`;

    const failingCriteria = Object.entries(currentAnalysis)
      .filter(([key, val]: [string, any]) => 
        ["independent","negotiable","valuable","estimable","small","testable"].includes(key) && 
        val?.score && val.score !== "pass"
      )
      .map(([key, val]: [string, any]) => `- ${key.toUpperCase()}: ${val.score} — ${val.notes}`)
      .join("\n");

    const userMessage = `Current story:
**Title:** ${story.title}
**Epic:** ${epic?.title || "Unknown"}
**Description:** ${story.description || "(none)"}
**Acceptance Criteria:** ${story.acceptanceCriteria || "(none)"}

**Failing/Warning criteria:**
${failingCriteria || "(none)"}

**Suggestions to apply:**
${currentAnalysis.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`;

    try {
      const rewriteResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        temperature: 0.1,
        system: rewritePrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const rewriteText = rewriteResponse.content[0]?.type === "text" ? rewriteResponse.content[0].text : "";
      const rewriteMatch = rewriteText.match(/\{[\s\S]*\}/);
      if (!rewriteMatch) {
        return res.status(500).json({ error: "Failed to parse rewrite response" });
      }

      const improved = JSON.parse(rewriteMatch[0]);
      await storage.updateStory(storyId, {
        title: improved.title || story.title,
        description: improved.description || story.description,
        acceptanceCriteria: improved.acceptanceCriteria || story.acceptanceCriteria,
      });

      const updatedStory = await storage.getStory(storyId);
      if (!updatedStory) return res.status(500).json({ error: "Story update failed" });

      const allStories = await storage.getStoriesByProject(story.projectId);
      const siblingStories = allStories
        .filter(s => s.epicId === story.epicId && s.id !== story.id && !s.mergedIntoStoryId)
        .map(s => `  - [ID:${s.id}] "${s.title}"`)
        .join("\n");

      const analyzeResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        temperature: 0.1,
        system: `You are Allie, the Story Analyst specializing in the INVEST framework (Bill Wake).

Evaluate this user story against all six INVEST criteria. Return your analysis as a JSON object (and ONLY a JSON object, no other text) in this exact format:

{
  "independent": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "negotiable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "valuable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "estimable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "small": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "testable": { "score": "pass|warn|fail", "notes": "Specific reasoning" },
  "summary": "One paragraph overall assessment",
  "suggestions": ["Specific improvement 1", "Specific improvement 2"]
}

If the story now fully passes all INVEST criteria, set suggestions to an empty array [].

Score meanings:
- "pass": Fully meets the criterion
- "warn": Partially meets, minor improvements needed
- "fail": Does not meet, significant rework needed`,
        messages: [{
          role: "user",
          content: `Evaluate this story:\n\n**Title:** ${updatedStory.title}\n**Epic:** ${epic?.title || "Unknown"}\n**Description:** ${updatedStory.description || "(none)"}\n**Acceptance Criteria:** ${updatedStory.acceptanceCriteria || "(none)"}\n**Priority:** ${updatedStory.priority}\n**Story Points:** ${updatedStory.storyPoints || "Not estimated"}\n\n**Other stories in the same epic:**\n${siblingStories || "(none)"}`
        }],
      });

      const analyzeText = analyzeResponse.content[0]?.type === "text" ? analyzeResponse.content[0].text : "";
      const analyzeMatch = analyzeText.match(/\{[\s\S]*\}/);
      if (!analyzeMatch) {
        return res.status(500).json({ error: "Failed to parse re-analysis" });
      }

      const newAnalysis = JSON.parse(analyzeMatch[0]);
      await storage.updateStory(storyId, { investAnalysis: newAnalysis });

      res.json({
        story: {
          ...updatedStory,
          investAnalysis: newAnalysis,
        },
        analysis: newAnalysis,
      });
    } catch (error: any) {
      console.error("INVEST apply error:", error);
      res.status(500).json({ error: error.message || "Apply suggestions failed" });
    }
  });

  // ── Bulk INVEST Analysis for all stories in project ──
  app.post("/api/projects/:id/invest-all", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const allStories = await storage.getStoriesByProject(projectId);
    const active = allStories.filter(s => !s.mergedIntoStoryId);
    const epics = await storage.getEpicsByProject(projectId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let completed = 0;
    for (const story of active) {
      try {
        const epic = epics.find(e => e.id === story.epicId);
        const siblings = active
          .filter(s => s.epicId === story.epicId && s.id !== story.id)
          .map(s => `  - [ID:${s.id}] "${s.title}"`)
          .join("\n");

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          temperature: 0.1,
          system: `You are Allie, the Story Analyst. Evaluate this story against INVEST. Return ONLY a JSON object with: independent, negotiable, valuable, estimable, small, testable (each with score "pass"|"warn"|"fail" and notes string), summary string, suggestions string array.`,
          messages: [{
            role: "user",
            content: `Story: "${story.title}"\nEpic: ${epic?.title || "?"}\nDescription: ${story.description || "(none)"}\nAC: ${story.acceptanceCriteria || "(none)"}\nPoints: ${story.storyPoints || "?"}\nSiblings:\n${siblings || "(none)"}`
          }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          res.write(`data: ${JSON.stringify({ type: "error", storyId: story.id, storyTitle: story.title, error: "Failed to parse INVEST response" })}\n\n`);
          continue;
        }
        try {
          const analysis = JSON.parse(jsonMatch[0]);
          await storage.updateStory(story.id, { investAnalysis: analysis });
          completed++;
          res.write(`data: ${JSON.stringify({ type: "progress", storyId: story.id, storyTitle: story.title, completed, total: active.length, analysis })}\n\n`);
        } catch (parseErr: any) {
          res.write(`data: ${JSON.stringify({ type: "error", storyId: story.id, storyTitle: story.title, error: "Invalid JSON in INVEST response" })}\n\n`);
        }
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: "error", storyId: story.id, storyTitle: story.title, error: err.message })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", completed, total: active.length })}\n\n`);
    res.end();
  });

  // ── Fred (Senior Scrum Master) chat — sprint planning with dependency analysis ──
  app.post("/api/projects/:id/fred-chat", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const { messages: chatHistory } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const allStories = await storage.getStoriesByProject(projectId);
      const allEpics = await storage.getEpicsByProject(projectId);
      const allSprints = await storage.getSprintsByProject(projectId);

      const storyContext = allStories
        .filter(s => !s.mergedIntoStoryId)
        .map(s => {
          const epic = allEpics.find(e => e.id === s.epicId);
          const sprint = allSprints.find(sp => sp.id === s.sprintId);
          const deps = s.dependsOn && s.dependsOn.length > 0 ? ` | Depends on: [${s.dependsOn.join(", ")}]` : "";
          return `  - [ID:${s.id}] "${s.title}" (Epic: ${epic?.title || "?"}, Status: ${s.status}, Priority: ${s.priority}, Points: ${s.storyPoints || "?"}, Sprint: ${sprint?.name || "Unassigned"}${deps})`;
        }).join("\n");

      const epicContext = allEpics.map(e => {
        const epicStories = allStories.filter(s => s.epicId === e.id && !s.mergedIntoStoryId);
        return `  - [Epic ID:${e.id}] "${e.title}" — ${epicStories.length} stories, ${epicStories.filter(s => s.status === "done").length} done`;
      }).join("\n");

      const sprintContext = allSprints.map(sp => {
        const spStories = allStories.filter(s => s.sprintId === sp.id);
        return `  - [Sprint ID:${sp.id}] "${sp.name}" (${sp.status}) — ${spStories.length} stories, Goal: ${sp.goal || "none"}`;
      }).join("\n");

      const systemPrompt = `You are Fred, the Senior Scrum Master in the BMad Method development framework.

Role: Senior Scrum Master + Sprint Planning Strategist

Identity: Veteran Scrum Master with 15+ years leading agile teams across enterprise banking, fintech, and large-scale distributed systems. Expert in dependency analysis, sprint sequencing, and backlog optimization.

Communication Style: Methodical and analytical. Present recommendations with clear reasoning backed by dependency chains and risk assessment. Use structured tables and priority matrices. Direct but collaborative — always explain the 'why' behind every recommendation.

You have access to the project's complete backlog data:

## Epics
${epicContext || "  (No epics yet)"}

## Stories
${storyContext || "  (No stories yet)"}

## Sprints
${sprintContext || "  (No sprints yet)"}

## Your Capabilities
1. **Sprint Recommendations**: Analyze all stories and recommend which should go into the next sprint based on dependencies, priority, and logical grouping.
2. **Dependency Analysis**: Identify which stories depend on other stories (e.g., "Story B requires the API from Story A to be built first").
3. **Story Grouping**: Find stories that should be implemented together because they share components, APIs, or data models.
4. **Risk Assessment**: Flag stories that are high-risk or likely to cause blockers.

## DEPENDENCY FORMAT
When you identify dependencies, present them in a structured format. After your analysis, if you recommend dependencies, include a JSON block at the end of your message in this exact format:

\`\`\`dependencies
[
  {"storyId": <id>, "dependsOn": [<id>, <id>]},
  {"storyId": <id>, "dependsOn": [<id>]}
]
\`\`\`

This allows the user to save your recommendations directly to the stories.

GUIDELINES:
- Be CONCISE and professional. Avoid lengthy preambles.
- Reference stories by their ID and title.
- Always explain WHY a dependency exists.
- Group related stories and explain the grouping logic.
- Recommend sprint assignments based on dependency order.
- Consider story points when recommending sprint load.`;

      const anthropicMessages = chatHistory.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        temperature: 0.1,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      let fullResponse = "";

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const delta = event.delta.text;
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ type: "content", content: delta })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Fred chat error:", error);
      res.write(`data: ${JSON.stringify({ type: "error", error: error.message || "Fred chat failed" })}\n\n`);
      res.end();
    }
  });

  // ── Save dependency recommendations from Fred ──
  app.post("/api/projects/:id/save-dependencies", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const { dependencies } = req.body;

    if (!Array.isArray(dependencies)) {
      return res.status(400).json({ error: "dependencies must be an array" });
    }

    const projectStories = await storage.getStoriesByProject(projectId);
    const projectStoryIds = new Set(projectStories.map(s => s.id));

    const results: { storyId: number; updated: boolean; error?: string }[] = [];

    for (const dep of dependencies) {
      const storyId = typeof dep?.storyId === "number" ? dep.storyId : parseInt(dep?.storyId);
      if (!storyId || isNaN(storyId)) {
        results.push({ storyId: dep?.storyId ?? 0, updated: false, error: "Invalid storyId" });
        continue;
      }
      if (!projectStoryIds.has(storyId)) {
        results.push({ storyId, updated: false, error: "Story not found in project" });
        continue;
      }
      const rawDeps = Array.isArray(dep.dependsOn) ? dep.dependsOn : [];
      const validDeps = rawDeps
        .map((id: any) => typeof id === "number" ? id : parseInt(id))
        .filter((id: number) => !isNaN(id) && projectStoryIds.has(id) && id !== storyId);
      try {
        await storage.updateStory(storyId, { dependsOn: validDeps });
        results.push({ storyId, updated: true });
      } catch (err: any) {
        results.push({ storyId, updated: false, error: err.message });
      }
    }

    res.json({ saved: results.filter(r => r.updated).length, total: results.length, results });
  });

  // ── Generate Claude Code prompt for a story ──
  app.post("/api/stories/:id/generate-prompt", async (req, res) => {
    const storyId = parseInt(req.params.id);
    const story = await storage.getStory(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const epic = await storage.getEpic(story.epicId);
    const docs = await storage.getDocumentsByProject(story.projectId);

    const archDoc = docs.find(d => d.docType === "architecture");
    const prdDoc = docs.find(d => d.docType === "prd");
    const uxDoc = docs.find(d => d.docType === "ux-design");

    const contextParts: string[] = [];
    contextParts.push(`# Story: ${story.title}`);
    if (epic) contextParts.push(`## Epic: ${epic.title}\n${epic.description || ""}`);
    contextParts.push(`## Description\n${story.description || "No description provided."}`);
    if (story.acceptanceCriteria) contextParts.push(`## Acceptance Criteria\n${story.acceptanceCriteria}`);
    if (story.priority) contextParts.push(`**Priority:** ${story.priority}`);
    if (story.storyPoints) contextParts.push(`**Story Points:** ${story.storyPoints}`);

    if (prdDoc) contextParts.push(`\n---\n## Project PRD (for context)\n${prdDoc.content.slice(0, 4000)}`);
    if (archDoc) contextParts.push(`\n---\n## Architecture Document (for context)\n${archDoc.content.slice(0, 4000)}`);
    if (uxDoc) contextParts.push(`\n---\n## UX Design (for context)\n${uxDoc.content.slice(0, 4000)}`);

    const systemPrompt = `You are a senior software engineer writing implementation prompts for Claude Code (an AI coding agent). Given a user story with its context, write a clear, actionable prompt that Claude Code can follow to implement the story.

Your prompt should:
- Be specific about what files to create or modify
- Include technical implementation details (APIs, data models, UI components)
- Reference the architecture and design docs when relevant
- Include acceptance criteria as testable requirements
- Be structured with clear sections
- Use markdown formatting

Write ONLY the prompt — no preamble, no explanation, no meta-commentary.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: "user", content: contextParts.join("\n\n") }],
      });

      let fullText = "";
      stream.on("text", (text) => {
        fullText += text;
        res.write(`data: ${JSON.stringify({ type: "text", text })}\n\n`);
      });

      stream.on("end", async () => {
        await storage.updateStory(storyId, { prompt: fullText });
        res.write(`data: ${JSON.stringify({ type: "done", prompt: fullText })}\n\n`);
        res.end();
      });

      stream.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
        res.end();
      });
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      res.end();
    }
  });

  // ── Aggregate prompts via Claude ──
  app.post("/api/projects/:id/aggregate-prompts", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const { storyIds } = req.body as { storyIds?: number[] };
    const allStories = await storage.getStoriesByProject(projectId);
    const targetStories = storyIds
      ? allStories.filter(s => storyIds.includes(s.id))
      : allStories.filter(s => s.status === "in-progress" && s.prompt && !s.mergedIntoStoryId);

    if (targetStories.length === 0) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.write(`data: ${JSON.stringify({ type: "error", error: "No stories with prompts found. Generate prompts for individual stories first." })}\n\n`);
      return res.end();
    }

    const epics = await storage.getEpicsByProject(projectId);
    const inputParts: string[] = [];
    inputParts.push(`# Individual Story Prompts to Synthesize\n`);
    inputParts.push(`There are ${targetStories.length} stories. Each has its own implementation prompt below.\n`);

    for (const story of targetStories) {
      const epic = epics.find(e => e.id === story.epicId);
      inputParts.push(`---\n## Story: ${story.title}`);
      if (epic) inputParts.push(`**Epic:** ${epic.title}`);
      if (story.description) inputParts.push(`**Description:** ${story.description}`);
      if (story.acceptanceCriteria) inputParts.push(`**Acceptance Criteria:**\n${story.acceptanceCriteria}`);
      if (story.prompt) inputParts.push(`**Individual Prompt:**\n${story.prompt}`);
      inputParts.push("");
    }

    const systemPrompt = `You are a senior software architect synthesizing multiple implementation prompts into a single, cohesive prompt for Claude Code (an AI coding agent).

You are given individual implementation prompts for multiple related user stories. Your job is to:
- Identify overlapping work, shared dependencies, and logical implementation order
- Combine them into ONE clear, well-structured prompt that Claude Code can execute
- Eliminate redundancy while preserving all requirements
- Organize the work into a logical sequence (e.g., schema changes first, then API, then UI)
- Include all acceptance criteria from all stories
- Flag any potential conflicts between stories

Write ONLY the synthesized prompt — no preamble, no explanation. Format in markdown.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: "user", content: inputParts.join("\n\n") }],
      });

      let fullText = "";
      stream.on("text", (text) => {
        fullText += text;
        res.write(`data: ${JSON.stringify({ type: "text", text })}\n\n`);
      });

      stream.on("end", () => {
        res.write(`data: ${JSON.stringify({ type: "done", prompt: fullText })}\n\n`);
        res.end();
      });

      stream.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
        res.end();
      });
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      res.end();
    }
  });

  // ── Detect duplicate stories ──
  app.get("/api/projects/:id/duplicate-stories", async (req, res) => {
    const projectId = parseInt(req.params.id);
    const allStories = await storage.getStoriesByProject(projectId);
    const active = allStories.filter(s => !s.mergedIntoStoryId);

    const duplicateGroups: { primary: number; duplicates: number[]; reason: string }[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < active.length; i++) {
      if (seen.has(active[i].id)) continue;
      const dupes: number[] = [];
      const a = active[i];
      const aNorm = a.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

      for (let j = i + 1; j < active.length; j++) {
        if (seen.has(active[j].id)) continue;
        const b = active[j];
        const bNorm = b.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

        const aWords = new Set(aNorm.split(/\s+/));
        const bWords = new Set(bNorm.split(/\s+/));
        const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 2);
        const union = new Set([...aWords, ...bWords]);
        const similarity = intersection.length / union.size;

        if (similarity > 0.6 || aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
          dupes.push(b.id);
          seen.add(b.id);
        }
      }

      if (dupes.length > 0) {
        seen.add(a.id);
        duplicateGroups.push({ primary: a.id, duplicates: dupes, reason: "Similar titles" });
      }
    }

    res.json({ groups: duplicateGroups, stories: active });
  });

  // ── Merge duplicate stories ──
  app.post("/api/stories/merge", async (req, res) => {
    const { primaryId, duplicateIds } = req.body as { primaryId: number; duplicateIds: number[] };
    if (!primaryId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
      return res.status(400).json({ error: "primaryId and non-empty duplicateIds array required" });
    }
    const primary = await storage.getStory(primaryId);
    if (!primary) return res.status(404).json({ error: "Primary story not found" });

    const dupes = [];
    for (const dupId of duplicateIds) {
      const dup = await storage.getStory(dupId);
      if (!dup) continue;
      if (dup.projectId !== primary.projectId) continue;
      dupes.push(dup);
    }

    let mergedDesc = primary.description;
    let mergedAC = primary.acceptanceCriteria;
    for (const dup of dupes) {
      if (dup.description && !mergedDesc.includes(dup.description)) {
        mergedDesc += "\n\n---\n*Merged from: " + dup.title + "*\n" + dup.description;
      }
      if (dup.acceptanceCriteria && !mergedAC.includes(dup.acceptanceCriteria)) {
        mergedAC += "\n" + dup.acceptanceCriteria;
      }
    }

    await storage.updateStory(primaryId, { description: mergedDesc, acceptanceCriteria: mergedAC });
    for (const dup of dupes) {
      await storage.updateStory(dup.id, { mergedIntoStoryId: primaryId, status: "done" });
    }

    const updated = await storage.getStory(primaryId);
    res.json(updated);
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
    if (parsed.length === 0) {
      return res.status(400).json({ error: "Could not parse any epics from the document. Check the document format." });
    }
    const totalStories = parsed.reduce((n, e) => n + e.stories.length, 0);
    if (totalStories === 0) {
      return res.status(400).json({ error: `Parsed ${parsed.length} epics but 0 stories. The document may use an unrecognized story format.` });
    }

    const existingEpics = await storage.getEpicsByProject(projectId);
    if (existingEpics.length > 0) {
      const existingStories = await storage.getStoriesByProject(projectId);
      for (const e of existingEpics) await storage.deleteEpic(e.id);
      for (const s of existingStories) await storage.deleteStory(s.id);
      console.log(`[import-epics] Cleared ${existingEpics.length} existing epics and ${existingStories.length} stories before re-import`);
    }

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

  // ── Import from GitHub repo ──
  app.post("/api/projects/import-github", async (req, res) => {
    const { repoUrl, intent } = req.body || {};
    if (!repoUrl || typeof repoUrl !== "string") {
      return res.status(400).json({ error: "repoUrl is required" });
    }
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return res.status(400).json({ error: "Could not parse GitHub URL. Use https://github.com/owner/repo or owner/repo." });
    }

    let snapshot: RepoSnapshot;
    try {
      snapshot = await fetchRepoSnapshot(parsed.owner, parsed.repo);
    } catch (err: any) {
      if (err instanceof PrivateRepoError) {
        return res.status(403).json({ error: err.message });
      }
      console.error("[import-github] fetch failed:", err?.message);
      return res.status(400).json({ error: `Failed to fetch repo: ${err?.message || "unknown error"}` });
    }

    const intentBlock = (intent && typeof intent === "string" && intent.trim())
      ? `\n\n## User's Intent for This Work\nThe user wants to introduce the following changes / goals into this codebase:\n${intent.trim()}\n`
      : `\n\n## User's Intent for This Work\n(Not specified. Infer likely improvement areas from the repository state and README.)\n`;

    const repoContext = buildRepoContextBlock(snapshot) + intentBlock;

    const projectName = snapshot.repo.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const projectDescription = snapshot.description
      ? `${snapshot.description} (imported from ${snapshot.owner}/${snapshot.repo})`
      : `Imported from ${snapshot.owner}/${snapshot.repo}`;

    const project = await storage.createProject({
      name: projectName,
      description: projectDescription,
      status: "active",
      phase: "analysis",
    });

    const DOC_PLAN: { docType: string; title: string; phase: string; agentName: string; instruction: string }[] = [
      {
        docType: "product-brief",
        title: "Product Brief",
        phase: "analysis",
        agentName: "Mary",
        instruction: `Produce a Product Brief for the work the user wants to do on this repository.
Structure the document with clear markdown headings:
# Product Brief — <project name>
## Vision & Problem
## Target Users
## Current State of the Codebase (based on repo)
## Proposed Changes (based on user intent)
## Success Metrics
## Risks & Constraints
## Issues Detected & Open Questions
In the final section, list every gap, ambiguity, or missing piece of information you could not confidently derive from the repository or user intent. Number each issue and phrase it as a question the user should answer.`,
      },
      {
        docType: "prd",
        title: "Product Requirements Document",
        phase: "planning",
        agentName: "John",
        instruction: `Produce a Product Requirements Document (PRD) grounded in both the repository and the Product Brief.
Structure:
# Product Requirements Document — <project name>
## Overview
## Goals & Non-Goals
## Functional Requirements
## Non-Functional Requirements
## User Flows
## Dependencies on Existing Code (reference concrete files/modules from the repo)
## Out of Scope
## Issues Detected & Open Questions
In the last section, list numbered open questions the user must resolve before implementation.`,
      },
      {
        docType: "ux-design",
        title: "UX Design",
        phase: "planning",
        agentName: "Sally",
        instruction: `Produce a UX Design document.
Structure:
# UX Design — <project name>
## User Personas
## Key User Journeys
## Screen Inventory (and which existing UI files, if any, are affected)
## Interaction & Accessibility Notes
## Issues Detected & Open Questions
If the repository does not appear to have a UI surface, say so explicitly in the Overview and focus the doc on API ergonomics or CLI UX instead.`,
      },
      {
        docType: "architecture",
        title: "Architecture Document",
        phase: "solutioning",
        agentName: "Winston",
        instruction: `Produce an Architecture Document that reflects the ACTUAL repository structure plus the changes needed.
Structure:
# Architecture — <project name>
## Current Architecture (summarize what exists, citing real paths from the file tree)
## Proposed Changes (what modules/files change, what new modules are added)
## Data Model Changes
## Integration Points & External Dependencies
## Migration / Rollout Plan
## Issues Detected & Open Questions
Always reference concrete file paths that exist in the repo when talking about current code. Do not invent file paths.`,
      },
      {
        docType: "epic",
        title: "Epics & Stories",
        phase: "solutioning",
        agentName: "John",
        instruction: `Produce an Epics & Stories document for implementing the changes. This document will be parsed by an importer, so follow the exact format:

# Epics & Stories — <project name>

## E1 — <Epic Title>
<1–3 sentence description of the epic>

### Story E1.1: <Story Title>
**Description:** <what needs to happen>
**Files to Change:** <bullet list or comma-separated list of concrete file paths from the repository that will be modified or created. Use real paths from the file tree.>
**Acceptance Criteria:**
- <criterion 1>
- <criterion 2>
**Priority:** critical | high | medium | low
**Story Points:** <integer>

### Story E1.2: ...

## E2 — <next epic>
...

Produce 3–6 epics, each with 2–5 stories. Every story MUST include a "Files to Change" bullet list with real file paths drawn from the repository tree. If a brand-new file is needed, name it with a realistic path that fits the project's conventions.

After all epics and stories, add a final section:
## Issues Detected & Open Questions
List numbered questions the user should resolve (ambiguous requirements, missing dependencies, untested assumptions, etc.).`,
      },
    ];

    const generatedDocs: { title: string; docType: string }[] = [];
    const priorDocs: { title: string; content: string }[] = [];

    try {
      for (const step of DOC_PLAN) {
        const priorSection = priorDocs.length
          ? `\n\n## Prior Documents In This Project\n` +
            priorDocs.map((d) => `### ${d.title}\n${d.content}`).join("\n\n---\n\n")
          : "";

        const userPrompt = `${repoContext}${priorSection}\n\n---\n\n## Your Task\n${step.instruction}\n\nReturn ONLY the markdown document. Do not wrap it in code fences. Do not add preamble or closing remarks.`;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          temperature: 0.1,
          system: `You are a senior member of a BMad Method delivery team (${step.agentName}). You are producing the "${step.title}" for a project that imports an existing GitHub repository. Ground every claim about existing code in the provided repository snapshot — never invent files or APIs that are not in the snapshot. When you are uncertain, put the uncertainty in the "Issues Detected & Open Questions" section rather than guessing.`,
          messages: [{ role: "user", content: userPrompt }],
        });

        const textBlocks = response.content.filter((b) => b.type === "text") as { type: "text"; text: string }[];
        const content = textBlocks.map((b) => b.text).join("\n").trim();
        if (!content) {
          throw new Error(`Model returned empty output for "${step.title}". Aborting import.`);
        }

        await storage.createDocument({
          projectId: project.id,
          sessionId: null,
          messageId: null,
          title: step.title,
          docType: step.docType,
          content,
          agentName: step.agentName,
          phase: step.phase,
        });

        generatedDocs.push({ title: step.title, docType: step.docType });
        priorDocs.push({ title: step.title, content });
      }
    } catch (err: any) {
      console.error("[import-github] doc generation failed:", err?.message);
      return res.status(500).json({
        error: `Generated ${generatedDocs.length} of ${DOC_PLAN.length} documents before failure: ${err?.message || "unknown error"}`,
        partial: true,
        project,
        projectId: project.id,
        generated: generatedDocs,
      });
    }

    if (generatedDocs.length !== DOC_PLAN.length) {
      return res.status(500).json({
        error: `Expected ${DOC_PLAN.length} documents but only ${generatedDocs.length} were created.`,
        partial: true,
        project,
        projectId: project.id,
        generated: generatedDocs,
      });
    }

    res.status(201).json({
      project,
      repo: { owner: snapshot.owner, repo: snapshot.repo, url: snapshot.url, defaultBranch: snapshot.defaultBranch },
      generated: generatedDocs,
      message: `Created project "${project.name}" with ${generatedDocs.length} documents. Review each document and resolve the flagged issues with the agents.`,
    });
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
  let collectingDesc = false;
  let descLines: string[] = [];

  function flushStory() {
    if (currentStory && currentEpic) {
      if (collectingAC && acLines.length > 0) {
        currentStory.acceptanceCriteria = acLines.join("\n");
      }
      if (collectingDesc && descLines.length > 0 && !currentStory.description) {
        currentStory.description = descLines.join("\n");
      }
      currentEpic.stories.push(currentStory);
    }
    currentStory = null;
    collectingAC = false;
    collectingDesc = false;
    acLines = [];
    descLines = [];
  }

  function isEpicHeading(trimmed: string): RegExpMatchArray | null {
    const m = trimmed.match(/^#{1,2}\s+(?:[^a-zA-Z]*\s*)?(?:epic\s*\d*[:\s]*|E\d+\s*[—–\-:]\s*)(.+)/i);
    if (m && /overview|summary|structure/i.test(m[1])) return null;
    return m;
  }

  function isStoryHeading(trimmed: string): string | null {
    let m: RegExpMatchArray | null;
    m = trimmed.match(/^#{2,4}\s+(?:[^a-zA-Z]*\s*)?(?:user\s+)?story\s*(?:E?\d+[\-.]?\d*)?[:\s—–\-]+(.+)/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim();

    m = trimmed.match(/^#{2,4}\s+S\d+[\.\-]\d+\s*[:\s—–\-]+(.+)/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim();

    m = trimmed.match(/^#{2,4}\s+S\d+[\.\-]\d+\s*[:\s—–\-]*(.+)/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim() || null;

    m = trimmed.match(/^#{3,4}\s+\d+[\.\-]\d+\s*[:\s—–\-]+(.+)/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim();

    m = trimmed.match(/^#{3,4}\s+(?:US|Task|Feature)\s*[\-#]?\d*[:\s—–\-]+(.+)/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim();

    m = trimmed.match(/^\*\*(?:User\s+)?Story\s+E?\d+[\.\-]?\d*\s*[:\s—–\-]+(.+?)\*\*/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim();

    m = trimmed.match(/^\*\*S\d+[\.\-]\d+[:\s—–\-]+(.+?)\*\*/i);
    if (m) return m[1].replace(/\*{1,2}/g, "").trim();

    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const stripped = trimmed.replace(/\*{1,2}/g, "").trim();

    const epicMatch = isEpicHeading(trimmed);
    if (epicMatch) {
      flushStory();
      if (currentEpic) result.push(currentEpic);
      currentEpic = { title: epicMatch[1].replace(/\*{1,2}/g, "").trim(), description: "", stories: [] };
      continue;
    }

    if (currentEpic) {
      const storyTitle = isStoryHeading(trimmed);
      if (storyTitle) {
        flushStory();
        currentStory = { title: storyTitle, description: "", acceptanceCriteria: "" };
        collectingDesc = false;
        continue;
      }
    }

    if (stripped.match(/^acceptance\s+criteria/i)) {
      if (currentStory && collectingDesc && descLines.length > 0) {
        currentStory.description = descLines.join("\n");
        descLines = [];
        collectingDesc = false;
      }
      collectingAC = true;
      acLines = [];
      continue;
    }

    if (stripped.match(/^description\s*[:\s]/i) && currentStory) {
      if (collectingAC && acLines.length > 0) {
        currentStory.acceptanceCriteria = acLines.join("\n");
        collectingAC = false;
        acLines = [];
      }
      const descVal = stripped.replace(/^description\s*[:\s]\s*/i, "").trim();
      if (descVal) currentStory.description = descVal;
      collectingDesc = true;
      descLines = [];
      continue;
    }

    if (stripped.match(/^(?:story\s+)?points?\s*[:\s]*\d+/i) && currentStory) {
      const pts = stripped.match(/(\d+)/);
      if (pts) currentStory.storyPoints = parseInt(pts[1]);
      if (collectingAC && acLines.length > 0) {
        currentStory.acceptanceCriteria = acLines.join("\n");
        collectingAC = false;
      }
      collectingDesc = false;
      continue;
    }

    if (stripped.match(/^priority\s*[:\s]*(low|medium|high|critical)/i) && currentStory) {
      const p = stripped.match(/(low|medium|high|critical)/i);
      if (p) currentStory.priority = p[1].toLowerCase();
      if (collectingAC && acLines.length > 0) {
        currentStory.acceptanceCriteria = acLines.join("\n");
        collectingAC = false;
      }
      collectingDesc = false;
      continue;
    }

    if (stripped.match(/^(?:estimate|size|effort)\s*[:\s]*\d+/i) && currentStory) {
      const pts = stripped.match(/(\d+)/);
      if (pts) currentStory.storyPoints = parseInt(pts[1]);
      continue;
    }

    if (stripped.match(/^(?:dependencies|depends\s+on|blocked\s+by)\s*[:\s]/i)) {
      continue;
    }

    if (trimmed.startsWith("|") || trimmed.match(/^\|?[\s-]+\|/)) continue;

    if (collectingAC && currentStory) {
      if (trimmed.startsWith("#") || (trimmed === "" && acLines.length > 0 && lines[i + 1]?.trim().startsWith("#"))) {
        currentStory.acceptanceCriteria = acLines.join("\n");
        collectingAC = false;
      } else if (trimmed) {
        acLines.push(trimmed);
      }
    } else if (collectingDesc && currentStory) {
      if (trimmed.startsWith("#") || trimmed.match(/^(?:\*{0,2})(?:acceptance|priority|points?|story\s+points?)/i)) {
        currentStory.description = descLines.join("\n");
        collectingDesc = false;
        i--;
      } else if (trimmed) {
        descLines.push(trimmed);
      }
    } else if (currentStory && !collectingAC && !collectingDesc && trimmed && !trimmed.startsWith("#")) {
      if (stripped.match(/^(?:story\s+)?points?\s*:/i) || stripped.match(/^priority\s*:/i) || stripped.match(/^(?:dependencies|depends\s+on|blocked\s+by)\s*:/i) || stripped.match(/^(?:estimate|size|effort)\s*:/i)) continue;
      if (currentStory.description) currentStory.description += "\n" + trimmed;
      else currentStory.description = trimmed;
    } else if (currentEpic && !currentStory && trimmed && !trimmed.startsWith("#")) {
      if (currentEpic.description) currentEpic.description += "\n" + trimmed;
      else currentEpic.description = trimmed;
    }
  }

  flushStory();
  if (currentEpic) result.push(currentEpic);

  console.log(`[parseEpics] Parsed ${result.length} epics with ${result.reduce((n, e) => n + e.stories.length, 0)} total stories`);
  for (const ep of result) {
    console.log(`  Epic: "${ep.title}" — ${ep.stories.length} stories`);
  }

  return result;
}
