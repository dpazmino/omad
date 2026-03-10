import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { BMAD_AGENTS, buildSystemPrompt } from "./agents";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

      // Build chat history
      const history = await storage.getMessages(sessionId);
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt(agent, session.partyMode) },
        ...history.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send user message event
      res.write(`data: ${JSON.stringify({ type: "user_message", message: userMsg })}\n\n`);

      // Stream OpenAI response
      const stream = await openai.chat.completions.create({
        model: agent.model || "gpt-5.2",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ type: "content", content: delta })}\n\n`);
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

        const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: buildSystemPrompt(agent, true) },
          ...baseHistory,
        ];

        const stream = await openai.chat.completions.create({
          model: agent.model || "gpt-5.2",
          messages: chatMessages,
          stream: true,
          max_completion_tokens: 8192,
        });

        let agentResponse = "";

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            agentResponse += delta;
            res.write(`data: ${JSON.stringify({ type: "content", content: delta, agentId: agent.id })}\n\n`);
          }
        }

        const assistantMsg = await storage.createMessage({
          sessionId,
          role: "assistant",
          content: agentResponse,
          agentId: agent.id,
          agentName: `${agent.name} (${agent.title})`,
        });

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

  return httpServer;
}
