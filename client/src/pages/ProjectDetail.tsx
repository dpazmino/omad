import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  ArrowLeft, Send, Bot, User, Users, Plus, Loader2, MessageSquare,
  GitBranch, ArrowRight, ChevronDown, Trash2, FolderKanban, Command,
  FileText, X, Download, PanelRightOpen, PanelRightClose, Eye, Code2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAgents, fetchMessages, createSession, deleteSession,
  streamChat, fetchProjectSessions, updateProject, updateSession,
  fetchProjectDocuments, deleteDocument, scanProjectDocuments,
  type StreamEvent
} from "@/lib/api";
import type { Agent, ChatMessage, Session, Project, Document } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { InteractiveResponse } from "@/components/InteractiveResponse";
import BoardView from "@/components/BoardView";

const COMMAND_AGENT_MAP: Record<string, string> = {
  BP: "Mary", MR: "Mary", CB: "Mary",
  CP: "John", VP: "John", CE: "John",
  CA: "Winston", IR: "Winston",
  CU: "Sally",
  SP: "Bob", CS: "Bob", CC: "Bob",
  DS: "DevAI", CR: "DevAI",
  QA: "Quinn",
};

const BMAD_PHASES = [
  {
    id: "analysis",
    title: "1. Analysis",
    description: "Research, brainstorm, and define your product brief.",
    agents: ["Mary (Business Analyst)"],
    commands: [
      { trigger: "BP", name: "Brainstorm Project" },
      { trigger: "MR", name: "Market Research" },
      { trigger: "CB", name: "Create Brief" },
    ]
  },
  {
    id: "planning",
    title: "2. Planning",
    description: "Create your PRD and UX design.",
    agents: ["John (Product Manager)", "Sally (UX Designer)"],
    commands: [
      { trigger: "CP", name: "Create PRD" },
      { trigger: "VP", name: "Validate PRD" },
      { trigger: "CU", name: "Create UX Design" },
    ]
  },
  {
    id: "solutioning",
    title: "3. Solutioning",
    description: "Define architecture, create epics and stories.",
    agents: ["Winston (Lead Architect)", "John (Product Manager)"],
    commands: [
      { trigger: "CA", name: "Create Architecture" },
      { trigger: "CE", name: "Create Epics & Stories" },
      { trigger: "IR", name: "Implementation Readiness" },
    ]
  },
  {
    id: "implementation",
    title: "4. Implementation",
    description: "Sprint planning, development, code review, and QA.",
    agents: ["Bob (Scrum Master)", "DevAI (Developer)", "Quinn (QA Engineer)"],
    commands: [
      { trigger: "SP", name: "Sprint Planning" },
      { trigger: "DS", name: "Dev Story" },
      { trigger: "CR", name: "Code Review" },
      { trigger: "QA", name: "QA Automate" },
    ]
  }
];

type Tab = "chat" | "workflows" | "board";

const COMMAND_PREREQUISITES: Record<string, { requires: string[]; label: string }> = {
  MR: { requires: ["brainstorm"], label: "Brainstorm Summary" },
  CB: { requires: ["brainstorm", "market-research"], label: "Brainstorm Summary + Market Research" },
  CP: { requires: ["product-brief"], label: "Product Brief" },
  VP: { requires: ["prd"], label: "PRD" },
  CU: { requires: ["prd"], label: "PRD" },
  CA: { requires: ["prd"], label: "PRD" },
  CE: { requires: ["architecture", "prd", "ux-design"], label: "Architecture + PRD + UX Design" },
  IR: { requires: ["architecture", "prd"], label: "Architecture + PRD" },
};

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id!);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [partyMode, setPartyMode] = useState(false);
  const [partyResponses, setPartyResponses] = useState<{ agentName: string; content: string; done: boolean }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Project not found");
      return res.json() as Promise<Project>;
    },
  });

  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: sessions = [] } = useQuery({
    queryKey: ["project-sessions", projectId],
    queryFn: () => fetchProjectSessions(projectId),
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", activeSessionId],
    queryFn: () => (activeSessionId ? fetchMessages(activeSessionId) : Promise.resolve([])),
    enabled: !!activeSessionId,
  });
  const { data: projectDocuments = [] } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => fetchProjectDocuments(projectId),
    refetchInterval: 5000,
  });

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeAgent = agents.find(a => a.id === activeSession?.activeAgentId);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, partyResponses, scrollToBottom]);

  const updatePhaseMutation = useMutation({
    mutationFn: (phase: string) => updateProject(projectId, { phase }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const [pendingCommand, setPendingCommand] = useState<{ trigger: string; sessionId: number; messageContent?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNewSession = async () => {
    const session = await createSession(undefined, projectId);
    queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
    setActiveSessionId(session.id);
    return session;
  };

  const getPrerequisiteDocs = (trigger: string): { met: boolean; missing: string[]; docs: Document[] } => {
    const prereqs = COMMAND_PREREQUISITES[trigger];
    if (!prereqs) return { met: true, missing: [], docs: [] };
    const missing: string[] = [];
    const docs: Document[] = [];
    for (const reqType of prereqs.requires) {
      const doc = projectDocuments.find(d => d.docType === reqType);
      if (doc) {
        docs.push(doc);
      } else {
        missing.push(reqType.replace("-", " "));
      }
    }
    return { met: missing.length === 0, missing, docs };
  };

  const handleCommand = async (trigger: string) => {
    if (isStreaming) return;

    const { met, missing, docs } = getPrerequisiteDocs(trigger);
    if (!met) {
      setErrorMessage(`Cannot run ${trigger}: missing required document(s): ${missing.join(", ")}. Complete the prerequisite step first.`);
      return;
    }

    const agentName = COMMAND_AGENT_MAP[trigger];
    const targetAgent = agents.find(a => a.name === agentName);

    let sessionId = activeSessionId;

    if (!sessionId) {
      const session = await createSession(trigger, projectId);
      queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
      setActiveSessionId(session.id);
      sessionId = session.id;
    }

    if (targetAgent) {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeAgentId: targetAgent.id }),
      });
      queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
    }

    let messageContent = trigger;
    if (docs.length > 0) {
      const contextParts = docs.map(d => `## ${d.title}\n${d.content}`);
      messageContent = `${trigger}\n\n---\n**Context from previous phase documents:**\n\n${contextParts.join("\n\n---\n\n")}`;
    }

    setPendingCommand({ trigger, sessionId, messageContent });
  };

  const handleDeleteSession = async (id: number) => {
    await deleteSession(id);
    queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find(s => s.id !== id)?.id || null);
    }
  };

  useEffect(() => {
    if (pendingCommand && pendingCommand.sessionId) {
      const { trigger, sessionId, messageContent } = pendingCommand;
      setPendingCommand(null);
      sendMessage(messageContent || trigger, sessionId, true);
    }
  }, [pendingCommand]);

  const sendMessage = async (messageContent: string, overrideSessionId?: number, skipAgentId?: boolean) => {
    const sid = overrideSessionId || activeSessionId;
    if (!messageContent.trim() || isStreaming || !sid) return;

    setIsStreaming(true);
    setStreamingContent("");
    setPartyResponses([]);
    setErrorMessage(null);

    const handleError = (event: StreamEvent) => {
      if (event.type === "error") {
        setErrorMessage(event.error || "Something went wrong. Please try again.");
      }
    };

    try {
      if (partyMode) {
        await streamChat(sid, messageContent, null, true, (event: StreamEvent) => {
          handleError(event);
          switch (event.type) {
            case "agent_start":
              setPartyResponses(prev => [...prev, { agentName: event.agentName, content: "", done: false }]);
              break;
            case "content":
              setPartyResponses(prev => {
                const updated = [...prev];
                if (updated.length > 0) updated[updated.length - 1].content += event.content;
                return updated;
              });
              break;
            case "agent_done":
              setPartyResponses(prev => {
                const updated = [...prev];
                if (updated.length > 0) updated[updated.length - 1].done = true;
                return updated;
              });
              break;
          }
        });
      } else {
        const sendAgentId = skipAgentId ? null : (activeAgent?.id || null);
        await streamChat(sid, messageContent, sendAgentId, false, (event: StreamEvent) => {
          handleError(event);
          if (event.type === "content") setStreamingContent(prev => prev + event.content);
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setErrorMessage(error.message || "Failed to send message. Please try again.");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setPartyResponses([]);
      queryClient.invalidateQueries({ queryKey: ["messages", sid] });
      queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userContent = input.trim();
    setInput("");

    if (!activeSessionId) {
      const session = await createSession(undefined, projectId);
      queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
      setActiveSessionId(session.id);
      await sendMessage(userContent, session.id);
    } else {
      await sendMessage(userContent);
    }
  };

  const handleAgentSwitch = async (agentId: number) => {
    if (!activeSessionId) return;
    await fetch(`/api/sessions/${activeSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeAgentId: agentId }),
    });
    queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
  };

  if (!project) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  const currentPhase = BMAD_PHASES.find(p => p.id === project.phase) || BMAD_PHASES[0];

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-screen">
        {/* Project Header */}
        <header className="border-b border-border bg-card shrink-0 px-4 py-2.5">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/projects" data-testid="link-back-projects" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2">
              <FolderKanban size={15} className="text-primary" />
              <h1 className="font-semibold text-sm" data-testid="text-project-detail-name">{project.name}</h1>
            </div>
            {project.description && (
              <span className="text-xs text-muted-foreground hidden md:block">— {project.description}</span>
            )}
          </div>

          {/* Phase selector + tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {BMAD_PHASES.map((phase, idx) => (
                <div key={phase.id} className="flex items-center gap-1">
                  <button
                    data-testid={`button-phase-${phase.id}`}
                    onClick={() => updatePhaseMutation.mutate(phase.id)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap border transition-colors",
                      project.phase === phase.id
                        ? "bg-primary text-white border-primary"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {phase.title}
                  </button>
                  {idx < BMAD_PHASES.length - 1 && (
                    <ArrowRight size={10} className="text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-0.5 shrink-0">
              <button
                data-testid="tab-chat"
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors",
                  activeTab === "chat"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <MessageSquare size={12} />
                Chat
              </button>
              <button
                data-testid="tab-board"
                onClick={() => setActiveTab("board")}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors",
                  activeTab === "board"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <FolderKanban size={12} />
                Board
              </button>
              <Link
                href={`/projects/${projectId}/dev`}
                data-testid="link-dev-view"
                className="px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Code2 size={12} />
                Dev View
              </Link>
              <button
                data-testid="tab-workflows"
                onClick={() => setActiveTab("workflows")}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors",
                  activeTab === "workflows"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <GitBranch size={12} />
                Workflows
              </button>
            </div>
          </div>
        </header>

        {activeTab === "chat" ? (
          <div className="flex-1 flex overflow-hidden">
            <ChatView
              sessions={sessions}
              messages={messages}
              agents={agents}
              activeSessionId={activeSessionId}
              activeSession={activeSession || null}
              activeAgent={activeAgent || null}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              partyMode={partyMode}
              partyResponses={partyResponses}
              input={input}
              messagesEndRef={messagesEndRef}
              onSetInput={setInput}
              onSetActiveSessionId={setActiveSessionId}
              onSetPartyMode={setPartyMode}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onSend={handleSend}
              onSendMessage={sendMessage}
              onCommand={handleCommand}
              onAgentSwitch={handleAgentSwitch}
              currentPhase={currentPhase}
              errorMessage={errorMessage}
              onDismissError={() => setErrorMessage(null)}
              showDocPanel={showDocPanel}
              onToggleDocPanel={() => setShowDocPanel(!showDocPanel)}
              projectDocuments={projectDocuments}
            />
            {showDocPanel && (
              <DocumentsPanel
                documents={projectDocuments}
                viewingDoc={viewingDoc}
                onViewDoc={setViewingDoc}
                onDeleteDoc={async (id) => {
                  await deleteDocument(id);
                  queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
                  if (viewingDoc?.id === id) setViewingDoc(null);
                }}
                onClose={() => setShowDocPanel(false)}
                onScan={async () => {
                  await scanProjectDocuments(projectId);
                  queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
                }}
              />
            )}
          </div>
        ) : activeTab === "board" ? (
          <div className="flex-1 overflow-auto">
            <BoardView projectId={projectId} />
          </div>
        ) : (
          <WorkflowsView phase={project.phase} />
        )}
      </div>
    </Layout>
  );
}

function ChatView({
  sessions, messages, agents, activeSessionId, activeSession, activeAgent,
  isStreaming, streamingContent, partyMode, partyResponses, input, messagesEndRef,
  onSetInput, onSetActiveSessionId, onSetPartyMode, onNewSession, onDeleteSession,
  onSend, onSendMessage, onCommand, onAgentSwitch, currentPhase,
  errorMessage, onDismissError, showDocPanel, onToggleDocPanel, projectDocuments,
}: {
  sessions: Session[];
  messages: ChatMessage[];
  agents: Agent[];
  activeSessionId: number | null;
  activeSession: Session | null;
  activeAgent: Agent | null;
  isStreaming: boolean;
  streamingContent: string;
  partyMode: boolean;
  partyResponses: { agentName: string; content: string; done: boolean }[];
  input: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSetInput: (v: string) => void;
  onSetActiveSessionId: (id: number) => void;
  onSetPartyMode: (v: boolean) => void;
  onNewSession: () => void;
  onDeleteSession: (id: number) => void;
  onSend: (e: React.FormEvent) => void;
  onSendMessage: (content: string) => void;
  onCommand: (trigger: string) => void;
  onAgentSwitch: (id: number) => void;
  currentPhase: typeof BMAD_PHASES[0];
  errorMessage: string | null;
  onDismissError: () => void;
  showDocPanel: boolean;
  onToggleDocPanel: () => void;
  projectDocuments: Document[];
}) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Session sidebar */}
      <div className="w-56 border-r border-border bg-card flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</span>
          <button
            data-testid="button-new-project-session"
            onClick={onNewSession}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6">
              No sessions yet. Start one!
            </div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              data-testid={`session-item-${s.id}`}
              className={cn(
                "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors",
                s.id === activeSessionId
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => onSetActiveSessionId(s.id)}
            >
              <MessageSquare size={12} className="shrink-0" />
              <span className="truncate flex-1">{s.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat toolbar */}
        <div className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-background">
          <div className="relative group">
            <button
              data-testid="button-agent-selector"
              className="px-2 py-1 rounded bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-border transition-colors border border-border"
            >
              <Users size={11} />
              {activeAgent ? activeAgent.name : "Select Agent"}
              <ChevronDown size={10} />
            </button>
            <div className="absolute top-full left-0 mt-1 w-48 bg-card rounded border border-border shadow-md hidden group-hover:block z-50 py-0.5">
              {agents.filter(a => a.status === "active").map(agent => (
                <button
                  key={agent.id}
                  data-testid={`button-agent-${agent.id}`}
                  onClick={() => onAgentSwitch(agent.id)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 transition-colors",
                    agent.id === activeAgent?.id && "bg-primary/8 text-primary"
                  )}
                >
                  <div>
                    <div className="font-medium text-foreground">{agent.name}</div>
                    <div className="text-muted-foreground text-[10px]">{agent.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            data-testid="button-party-mode"
            onClick={() => onSetPartyMode(!partyMode)}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1",
              partyMode
                ? "bg-accent/10 text-accent border-accent/20"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <Users size={11} />
            Team: {partyMode ? "On" : "Off"}
          </button>

          <button
            data-testid="button-toggle-docs"
            onClick={onToggleDocPanel}
            className={cn(
              "px-2 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1",
              showDocPanel
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {showDocPanel ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
            Docs
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Claude
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth" data-testid="chat-messages">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
              <div className="w-10 h-10 rounded bg-primary flex items-center justify-center mb-3">
                <Bot size={20} className="text-white" />
              </div>
              <h2 className="text-base font-semibold mb-1">
                Phase: {currentPhase.title}
              </h2>
              <p className="text-muted-foreground max-w-md mb-4 text-sm">
                {currentPhase.description}
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {currentPhase.commands.map(cmd => {
                  const prereqs = COMMAND_PREREQUISITES[cmd.trigger];
                  const prereqsMet = !prereqs || prereqs.requires.every(
                    reqType => projectDocuments.some(d => d.docType === reqType)
                  );
                  return (
                    <button
                      key={cmd.trigger}
                      data-testid={`button-command-${cmd.trigger}`}
                      onClick={() => prereqsMet ? onCommand(cmd.trigger) : undefined}
                      disabled={!prereqsMet}
                      title={!prereqsMet ? `Requires: ${prereqs!.label}` : undefined}
                      className={cn(
                        "px-2.5 py-1 text-xs border rounded transition-colors",
                        prereqsMet
                          ? "bg-muted hover:bg-border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                          : "bg-muted/50 border-border/50 text-muted-foreground/40 cursor-not-allowed"
                      )}
                    >
                      <span className={cn("font-mono mr-1", prereqsMet ? "text-primary" : "text-primary/30")}>{cmd.trigger}</span>
                      {cmd.name}
                      {!prereqsMet && <span className="ml-1 text-[10px]">(needs {prereqs!.label})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              agents={agents}
              isLastAssistantMessage={msg.role === "assistant" && idx === messages.length - 1}
              isStreaming={isStreaming}
              onSubmitAnswers={(response) => onSendMessage(response)}
            />
          ))}

          {isStreaming && !partyMode && streamingContent && (
            <div className="flex max-w-4xl mr-auto">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold text-white">
                  AI
                </div>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                    {activeAgent ? `${activeAgent.name} — ${activeAgent.title}` : "Agent"}
                  </span>
                  <div className="bg-card px-4 py-3 rounded border border-border max-w-[85%]">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isStreaming && partyMode && partyResponses.map((pr, idx) => (
            <div key={idx} className="flex max-w-4xl mr-auto">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold text-white">
                  AI
                </div>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-[10px] text-muted-foreground font-medium ml-0.5">{pr.agentName}</span>
                  <div className="bg-card px-4 py-3 rounded border border-border max-w-[85%]">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{pr.content}</ReactMarkdown>
                    </div>
                    {!pr.done && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Loader2 size={11} className="animate-spin text-primary" />
                        <span className="text-[10px] text-muted-foreground">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isStreaming && !streamingContent && partyResponses.length === 0 && (
            <div className="flex max-w-4xl mr-auto">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded bg-primary/70 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold text-white">
                  AI
                </div>
                <div className="bg-card px-4 py-3 rounded border border-border flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {errorMessage && (
          <div className="px-4 py-3 shrink-0 border-t border-red-200 bg-red-50" data-testid="error-banner">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="flex-1 text-sm text-red-600">
                <span className="font-medium">Error:</span> {errorMessage}
              </div>
              <button
                data-testid="button-dismiss-error"
                onClick={onDismissError}
                className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-100 transition-colors"
              >
                Dismiss
              </button>
              <button
                data-testid="button-retry"
                onClick={() => {
                  onDismissError();
                  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
                  if (lastUserMsg) onSendMessage(lastUserMsg.content);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="p-3 shrink-0 bg-card border-t border-border z-10">
          <form onSubmit={onSend} className="max-w-4xl mx-auto relative" data-testid="chat-form">
            <div className="relative flex items-end gap-2 bg-background border border-border rounded p-1.5 transition-colors focus-within:border-primary/40">
              <div className="flex-1 pl-2">
                <textarea
                  data-testid="input-chat"
                  value={input}
                  onChange={(e) => onSetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(e); }
                  }}
                  placeholder={activeAgent ? `Message ${activeAgent.name}...` : "Type a message..."}
                  className="w-full max-h-28 min-h-[36px] bg-transparent border-none outline-none resize-none py-2 text-sm placeholder:text-muted-foreground focus:ring-0 text-foreground"
                  rows={1}
                  disabled={isStreaming || !activeSessionId}
                />
              </div>
              <button
                type="submit"
                data-testid="button-send"
                disabled={!input.trim() || isStreaming || !activeSessionId}
                className="w-8 h-8 shrink-0 rounded bg-primary text-white flex items-center justify-center mb-0.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {isStreaming ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
              <button
                type="button"
                data-testid="button-help"
                onClick={() => onSetInput("/bmad-help")}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Command size={10} /> /bmad-help
              </button>
              <span>Press <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border">Enter</kbd> to send</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function WorkflowsView({ phase }: { phase: string }) {
  const currentPhaseIdx = BMAD_PHASES.findIndex(p => p.id === phase);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Project Workflows</h2>
          <p className="text-sm text-muted-foreground">
            Follow the BMad Method phases to guide your project from idea to implementation.
          </p>
        </div>

        {BMAD_PHASES.map((phase, idx) => {
          const isCurrent = idx === currentPhaseIdx;
          const isPast = idx < currentPhaseIdx;

          return (
            <div
              key={phase.id}
              data-testid={`card-workflow-phase-${phase.id}`}
              className={cn(
                "bg-card p-4 rounded-md border relative overflow-hidden transition-colors",
                isCurrent ? "border-primary/20" : "border-border",
                isPast && "opacity-70"
              )}
            >
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                isCurrent ? "bg-primary" : isPast ? "bg-green-500" : "bg-border"
              )} />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg border",
                    isCurrent
                      ? "bg-primary/10 border-primary/30"
                      : isPast
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-muted border-border"
                  )}>
                    <GitBranch size={16} className={cn(
                      isCurrent ? "text-primary" : isPast ? "text-green-500" : "text-muted-foreground"
                    )} />
                  </div>
                  <h3 className="text-lg font-semibold text-sm">{phase.title}</h3>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium border border-primary/30">
                      Current
                    </span>
                  )}
                  {isPast && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20">
                      Done
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground ml-12">{phase.description}</p>

                <div className="ml-12 space-y-2">
                  <div className="text-xs font-medium text-foreground">Agents:</div>
                  <div className="flex flex-wrap gap-2">
                    {phase.agents.map(agent => (
                      <span key={agent} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs border border-primary/20">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="ml-12 space-y-2">
                  <div className="text-xs font-medium text-foreground">Commands:</div>
                  <div className="flex flex-wrap gap-2">
                    {phase.commands.map(cmd => (
                      <span key={cmd.trigger} className="px-2.5 py-1.5 rounded-md bg-muted text-xs text-muted-foreground border border-border">
                        <span className="font-mono text-primary mr-1">{cmd.trigger}</span>
                        {cmd.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageBubble({ message, agents, isLastAssistantMessage, isStreaming, onSubmitAnswers }: {
  message: ChatMessage;
  agents: Agent[];
  isLastAssistantMessage: boolean;
  isStreaming: boolean;
  onSubmitAnswers: (response: string) => void;
}) {
  const isUser = message.role === "user";
  const agent = message.agentId ? agents.find(a => a.id === message.agentId) : null;

  return (
    <div
      data-testid={`message-${message.id}`}
      className={cn(
        "flex max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "ml-auto" : "mr-auto"
      )}
    >
      <div className={cn("flex gap-4 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
        <div className={cn(
          "w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold",
          isUser
            ? "bg-muted border border-border text-muted-foreground"
            : "bg-primary text-white"
        )}>
          {isUser ? <User size={14} className="text-muted-foreground" /> : (
            agent ? agent.name.slice(0, 2).toUpperCase() : "AI"
          )}
        </div>
        <div className={cn("flex flex-col gap-0.5", isUser ? "items-end" : "items-start")}>
          {!isUser && message.agentName && (
            <span className="text-[10px] text-muted-foreground font-medium ml-0.5">{message.agentName}</span>
          )}
          <div className={cn(
            "px-4 py-3 rounded text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground max-w-[85%]"
              : "bg-card text-foreground border border-border max-w-full min-w-[300px]"
          )}>
            {isUser ? (
              message.content
            ) : (
              <InteractiveResponse
                content={message.content}
                onSubmitAnswers={onSubmitAnswers}
                isLastMessage={isLastAssistantMessage}
                disabled={isStreaming}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DOC_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  "product-brief": { icon: "PB", color: "text-blue-600" },
  "brainstorm": { icon: "BS", color: "text-yellow-600" },
  "market-research": { icon: "MR", color: "text-green-600" },
  "prd": { icon: "PR", color: "text-purple-600" },
  "ux-design": { icon: "UX", color: "text-pink-600" },
  "architecture": { icon: "AR", color: "text-orange-600" },
  "epic": { icon: "EP", color: "text-yellow-600" },
  "stories": { icon: "ST", color: "text-cyan-600" },
  "sprint-plan": { icon: "SP", color: "text-emerald-600" },
  "implementation-plan": { icon: "IP", color: "text-amber-600" },
  "code-review": { icon: "CR", color: "text-red-600" },
  "qa-report": { icon: "QA", color: "text-teal-600" },
  "test-plan": { icon: "TP", color: "text-indigo-600" },
  "general": { icon: "GN", color: "text-gray-500" },
};

function DocumentsPanel({
  documents, viewingDoc, onViewDoc, onDeleteDoc, onClose, onScan,
}: {
  documents: Document[];
  viewingDoc: Document | null;
  onViewDoc: (doc: Document | null) => void;
  onDeleteDoc: (id: number) => void;
  onClose: () => void;
  onScan: () => void;
}) {
  const [scanning, setScanning] = useState(false);

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col shrink-0 hidden lg:flex" data-testid="documents-panel">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</span>
          {documents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
              {documents.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="button-scan-docs"
            onClick={async () => { setScanning(true); await onScan(); setScanning(false); }}
            disabled={scanning}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Scan conversations for documents"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
          <button
            data-testid="button-close-docs"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {viewingDoc ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <button
              data-testid="button-back-to-docs"
              onClick={() => onViewDoc(null)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs font-medium truncate flex-1">{viewingDoc.title}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{viewingDoc.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center mb-3">
                <FileText size={20} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">No documents yet</p>
              <p className="text-[10px] text-muted-foreground/70">
                Documents are auto-saved when agents create briefs, PRDs, architecture docs, and other artifacts.
              </p>
            </div>
          ) : (
            documents.map(doc => {
              const typeInfo = DOC_TYPE_ICONS[doc.docType] || DOC_TYPE_ICONS["general"];
              return (
                <div
                  key={doc.id}
                  data-testid={`doc-item-${doc.id}`}
                  className="group bg-card rounded border border-border hover:border-primary/15 transition-colors cursor-pointer"
                >
                  <div className="p-3" onClick={() => onViewDoc(doc)}>
                    <div className="flex items-start gap-2.5">
                      <span className={cn("text-[10px] font-semibold w-7 h-7 rounded bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5", typeInfo.color)}>{typeInfo.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{doc.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted", typeInfo.color)}>
                            {doc.docType.replace("-", " ")}
                          </span>
                        </div>
                        {doc.agentName && (
                          <div className="text-[10px] text-muted-foreground mt-1 truncate">
                            by {doc.agentName}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 pb-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      data-testid={`button-view-doc-${doc.id}`}
                      onClick={() => onViewDoc(doc)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] hover:bg-primary/20 transition-colors"
                    >
                      <Eye size={10} /> View
                    </button>
                    <button
                      data-testid={`button-delete-doc-${doc.id}`}
                      onClick={() => onDeleteDoc(doc.id)}
                      className="flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-500 text-[10px] hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
