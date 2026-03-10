import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  ArrowLeft, Send, Bot, User, Sparkles, Plus, Loader2, MessageSquare,
  GitBranch, ArrowRight, ChevronDown, Trash2, FolderKanban, Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAgents, fetchMessages, createSession, deleteSession,
  streamChat, fetchProjectSessions, updateProject, updateSession,
  type StreamEvent
} from "@/lib/api";
import type { Agent, ChatMessage, Session, Project } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { InteractiveResponse } from "@/components/InteractiveResponse";

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
    agents: ["📊 Mary (Business Analyst)"],
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
    agents: ["📋 John (Product Manager)", "🎨 Sally (UX Designer)"],
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
    agents: ["🏗️ Winston (Lead Architect)", "📋 John (Product Manager)"],
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
    agents: ["🏃 Bob (Scrum Master)", "💻 DevAI (Developer)", "🧪 Quinn (QA Engineer)"],
    commands: [
      { trigger: "SP", name: "Sprint Planning" },
      { trigger: "DS", name: "Dev Story" },
      { trigger: "CR", name: "Code Review" },
      { trigger: "QA", name: "QA Automate" },
    ]
  }
];

type Tab = "chat" | "workflows";

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

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeAgent = agents.find(a => a.id === activeSession?.activeAgentId);

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

  const [pendingCommand, setPendingCommand] = useState<{ trigger: string; sessionId: number } | null>(null);

  const handleNewSession = async () => {
    const session = await createSession(undefined, projectId);
    queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
    setActiveSessionId(session.id);
    return session;
  };

  const handleCommand = async (trigger: string) => {
    if (isStreaming) return;

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

    setPendingCommand({ trigger, sessionId });
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
      const { trigger, sessionId } = pendingCommand;
      setPendingCommand(null);
      sendMessage(trigger, sessionId);
    }
  }, [pendingCommand]);

  const sendMessage = async (messageContent: string, overrideSessionId?: number) => {
    const sid = overrideSessionId || activeSessionId;
    if (!messageContent.trim() || isStreaming || !sid) return;

    setIsStreaming(true);
    setStreamingContent("");
    setPartyResponses([]);

    try {
      if (partyMode) {
        await streamChat(sid, messageContent, null, true, (event: StreamEvent) => {
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
        await streamChat(sid, messageContent, activeAgent?.id || null, false, (event: StreamEvent) => {
          if (event.type === "content") setStreamingContent(prev => prev + event.content);
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setPartyResponses([]);
      queryClient.invalidateQueries({ queryKey: ["messages", sid] });
      queryClient.invalidateQueries({ queryKey: ["project-sessions", projectId] });
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
        <header className="border-b border-border/50 glass-panel shrink-0 px-6 py-3">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/projects" data-testid="link-back-projects" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <FolderKanban size={18} className="text-primary" />
              <h1 className="font-heading font-bold text-lg" data-testid="text-project-detail-name">{project.name}</h1>
            </div>
            {project.description && (
              <span className="text-sm text-muted-foreground hidden md:block">— {project.description}</span>
            )}
          </div>

          {/* Phase selector + tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {BMAD_PHASES.map((phase, idx) => (
                <div key={phase.id} className="flex items-center gap-1.5">
                  <button
                    data-testid={`button-phase-${phase.id}`}
                    onClick={() => updatePhaseMutation.mutate(phase.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all",
                      project.phase === phase.id
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-white/5 text-muted-foreground border-white/10 hover:border-primary/20 hover:text-foreground"
                    )}
                  >
                    {phase.title}
                  </button>
                  {idx < BMAD_PHASES.length - 1 && (
                    <ArrowRight size={12} className="text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-1 shrink-0">
              <button
                data-testid="tab-chat"
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                  activeTab === "chat"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <MessageSquare size={14} />
                Chat
              </button>
              <button
                data-testid="tab-workflows"
                onClick={() => setActiveTab("workflows")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                  activeTab === "workflows"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <GitBranch size={14} />
                Workflows
              </button>
            </div>
          </div>
        </header>

        {activeTab === "chat" ? (
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
          />
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
}) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Session sidebar */}
      <div className="w-56 border-r border-border/50 glass-panel flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</span>
          <button
            data-testid="button-new-project-session"
            onClick={onNewSession}
            className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
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
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
              onClick={() => onSetActiveSessionId(s.id)}
            >
              <MessageSquare size={12} className="shrink-0" />
              <span className="truncate flex-1">{s.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-destructive transition-all"
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
        <div className="h-12 border-b border-border/30 flex items-center px-4 gap-3 shrink-0">
          <div className="relative group">
            <button
              data-testid="button-agent-selector"
              className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium flex items-center gap-1 hover:bg-primary/30 transition-colors"
            >
              <Bot size={12} />
              {activeAgent ? `${activeAgent.icon} ${activeAgent.name}` : "Select Agent"}
              <ChevronDown size={10} />
            </button>
            <div className="absolute top-full left-0 mt-1 w-56 glass-panel rounded-lg border border-border/50 shadow-xl hidden group-hover:block z-50 py-1">
              {agents.filter(a => a.status === "active").map(agent => (
                <button
                  key={agent.id}
                  data-testid={`button-agent-${agent.id}`}
                  onClick={() => onAgentSwitch(agent.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 transition-colors",
                    agent.id === activeAgent?.id && "bg-primary/10 text-primary"
                  )}
                >
                  <span>{agent.icon}</span>
                  <div>
                    <div className="font-medium">{agent.name}</div>
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
              "px-2 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1",
              partyMode
                ? "bg-accent/20 text-accent border-accent/30"
                : "bg-white/5 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <Sparkles size={12} />
            Party: {partyMode ? "On" : "Off"}
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            OpenAI
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth" data-testid="chat-messages">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-heading font-bold mb-2">
                Phase: {currentPhase.title}
              </h2>
              <p className="text-muted-foreground max-w-md mb-4 text-sm">
                {currentPhase.description}
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {currentPhase.commands.map(cmd => (
                  <button
                    key={cmd.trigger}
                    data-testid={`button-command-${cmd.trigger}`}
                    onClick={() => onCommand(cmd.trigger)}
                    className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-border/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="font-mono text-primary mr-1">{cmd.trigger}</span>
                    {cmd.name}
                  </button>
                ))}
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
            <div className="flex max-w-4xl mr-auto animate-in fade-in">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-primary/20">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-xs text-muted-foreground font-medium ml-1">
                    {activeAgent ? `${activeAgent.icon} ${activeAgent.name} (${activeAgent.title})` : "Agent"}
                  </span>
                  <div className="glass-card px-5 py-3.5 rounded-2xl rounded-tl-sm border border-white/5 max-w-[85%]">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isStreaming && partyMode && partyResponses.map((pr, idx) => (
            <div key={idx} className="flex max-w-4xl mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-primary/20">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-xs text-muted-foreground font-medium ml-1">{pr.agentName}</span>
                  <div className="glass-card px-5 py-3.5 rounded-2xl rounded-tl-sm border border-white/5 max-w-[85%]">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{pr.content}</ReactMarkdown>
                    </div>
                    {!pr.done && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Loader2 size={12} className="animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isStreaming && !streamingContent && partyResponses.length === 0 && (
            <div className="flex max-w-4xl mr-auto animate-in fade-in">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 shrink-0 glass-panel border-t border-border/50 z-10">
          <form onSubmit={onSend} className="max-w-4xl mx-auto relative group" data-testid="chat-form">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-end gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-2xl transition-all duration-300 focus-within:border-primary/50 focus-within:bg-black/60">
              <div className="flex-1 pl-2">
                <textarea
                  data-testid="input-chat"
                  value={input}
                  onChange={(e) => onSetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(e); }
                  }}
                  placeholder={activeAgent ? `Ask ${activeAgent.name} (${activeAgent.title})...` : "Start typing..."}
                  className="w-full max-h-32 min-h-[44px] bg-transparent border-none outline-none resize-none py-3 text-sm placeholder:text-muted-foreground focus:ring-0"
                  rows={1}
                  disabled={isStreaming || !activeSessionId}
                />
              </div>
              <button
                type="submit"
                data-testid="button-send"
                disabled={!input.trim() || isStreaming || !activeSessionId}
                className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center mb-1 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 transition-all duration-200"
              >
                {isStreaming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} className={cn("transition-transform duration-200", input.trim() && "translate-x-0.5 -translate-y-0.5")} />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <button
                type="button"
                data-testid="button-help"
                onClick={() => onSetInput("/bmad-help")}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Command size={12} /> /bmad-help
              </button>
              <div>Press <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded text-[10px]">Enter</kbd> to send</div>
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
          <h2 className="text-xl font-heading font-bold mb-1">Project Workflows</h2>
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
                "glass-card p-5 rounded-2xl border relative overflow-hidden transition-all",
                isCurrent ? "border-primary/30" : "border-white/5",
                isPast && "opacity-70"
              )}
            >
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                isCurrent ? "bg-primary" : isPast ? "bg-green-500" : "bg-white/10"
              )} />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg border",
                    isCurrent
                      ? "bg-primary/10 border-primary/30"
                      : isPast
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-white/5 border-white/10"
                  )}>
                    <GitBranch size={16} className={cn(
                      isCurrent ? "text-primary" : isPast ? "text-green-500" : "text-muted-foreground"
                    )} />
                  </div>
                  <h3 className="text-lg font-heading font-semibold">{phase.title}</h3>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium border border-primary/30">
                      Current
                    </span>
                  )}
                  {isPast && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30">
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
                      <span key={cmd.trigger} className="px-2.5 py-1.5 rounded-md bg-white/5 text-xs text-muted-foreground border border-white/5">
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
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
          isUser
            ? "bg-secondary"
            : "bg-gradient-to-br from-primary/80 to-accent/80 text-white shadow-lg shadow-primary/20"
        )}>
          {isUser ? <User size={16} /> : (
            agent ? <span className="text-sm">{agent.icon}</span> : <Bot size={16} />
          )}
        </div>
        <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
          {!isUser && message.agentName && (
            <span className="text-xs text-muted-foreground font-medium ml-1">{message.agentName}</span>
          )}
          <div className={cn(
            "px-5 py-3.5 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm max-w-[85%]"
              : "glass-card text-foreground rounded-tl-sm border border-white/5 max-w-full min-w-[300px]"
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
