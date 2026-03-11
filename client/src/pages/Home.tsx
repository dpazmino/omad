import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Send, User, Command, Plus, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAgents, fetchMessages, fetchSessions, createSession, streamChat, type StreamEvent } from "@/lib/api";
import type { Agent, ChatMessage, Session } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgentName, setStreamingAgentName] = useState("");
  const [partyMode, setPartyMode] = useState(false);
  const [partyResponses, setPartyResponses] = useState<{ agentName: string; content: string; done: boolean }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: sessions = [] } = useQuery({ queryKey: ["sessions"], queryFn: fetchSessions });
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

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, partyResponses, scrollToBottom]);

  const handleNewSession = async () => {
    const session = await createSession();
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    setActiveSessionId(session.id);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !activeSessionId) return;

    const userContent = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingAgentName("");
    setPartyResponses([]);

    try {
      if (partyMode) {
        await streamChat(activeSessionId, userContent, null, true, (event: StreamEvent) => {
          switch (event.type) {
            case "agent_start":
              setPartyResponses(prev => [...prev, { agentName: event.agentName, content: "", done: false }]);
              break;
            case "content":
              setPartyResponses(prev => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1].content += event.content;
                }
                return updated;
              });
              break;
            case "agent_done":
              setPartyResponses(prev => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1].done = true;
                }
                return updated;
              });
              break;
          }
        });
      } else {
        await streamChat(activeSessionId, userContent, activeAgent?.id || null, false, (event: StreamEvent) => {
          switch (event.type) {
            case "content":
              setStreamingContent(prev => prev + event.content);
              break;
            case "done":
              if (event.message) {
                setStreamingAgentName(event.message.agentName || "");
              }
              break;
          }
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingAgentName("");
      setPartyResponses([]);
      queryClient.invalidateQueries({ queryKey: ["messages", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  };

  const handleAgentSwitch = async (agentId: number) => {
    if (!activeSessionId) return;
    await fetch(`/api/sessions/${activeSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeAgentId: agentId }),
    });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-screen relative bg-background">
        <header className="h-12 border-b border-border bg-card flex items-center px-4 justify-between shrink-0 sticky top-0 z-10" data-testid="chat-header">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-foreground">{activeSession?.title || "New Session"}</h2>
            <div className="flex gap-1.5 flex-wrap">
              <div className="relative group">
                <button
                  data-testid="button-agent-selector"
                  className="px-2 py-1 rounded bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-border transition-colors border border-border"
                >
                  <Users size={11} />
                  {activeAgent ? activeAgent.name : "Select Agent"}
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-card rounded border border-border shadow-md hidden group-hover:block z-50 py-0.5">
                  {agents.filter(a => a.status === "active").map(agent => (
                    <button
                      key={agent.id}
                      data-testid={`button-agent-${agent.id}`}
                      onClick={() => handleAgentSwitch(agent.id)}
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
                onClick={() => setPartyMode(!partyMode)}
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-new-session"
              onClick={handleNewSession}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted px-2.5 py-1 rounded border border-border"
            >
              <Plus size={11} />
              New
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-2.5 py-1 border border-border rounded bg-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth" data-testid="chat-messages">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-10 h-10 rounded bg-primary flex items-center justify-center mb-3">
                <Users size={20} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold mb-1 text-foreground">BMad Method</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                {activeAgent
                  ? `${activeAgent.name} (${activeAgent.title}) is ready.`
                  : "Start a conversation with your AI development team."}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-lg">
                {activeAgent?.menuCommands?.map((cmd: any) => (
                  <button
                    key={cmd.trigger}
                    data-testid={`button-command-${cmd.trigger}`}
                    onClick={() => setInput(cmd.trigger)}
                    className="px-2.5 py-1 text-xs bg-muted hover:bg-border border border-border rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {cmd.description}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} agents={agents} />
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
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
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
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{pr.content}</ReactMarkdown>
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

        <div className="p-3 shrink-0 bg-card border-t border-border z-10">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative" data-testid="chat-form">
            <div className="relative flex items-end gap-2 bg-background border border-border rounded p-1.5 transition-colors focus-within:border-primary/40">
              <div className="flex-1 pl-2">
                <textarea
                  ref={textareaRef}
                  data-testid="input-chat"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder={activeAgent ? `Message ${activeAgent.name}...` : "Type a message..."}
                  className="w-full max-h-28 min-h-[36px] bg-transparent border-none outline-none resize-none py-2 text-sm placeholder:text-muted-foreground focus:ring-0 text-foreground"
                  rows={1}
                  disabled={isStreaming}
                />
              </div>
              <button
                type="submit"
                data-testid="button-send"
                disabled={!input.trim() || isStreaming}
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
                onClick={() => setInput("/bmad-help")}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Command size={10} /> /bmad-help
              </button>
              <span>Press <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border">Enter</kbd> to send</span>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

function MessageBubble({ message, agents }: { message: ChatMessage; agents: Agent[] }) {
  const isUser = message.role === "user";
  const agent = message.agentId ? agents.find(a => a.id === message.agentId) : null;

  return (
    <div
      data-testid={`message-${message.id}`}
      className={cn(
        "flex max-w-4xl",
        isUser ? "ml-auto" : "mr-auto"
      )}
    >
      <div className={cn("flex gap-3 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
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
            "px-4 py-3 rounded max-w-[85%] text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground border border-border"
          )}>
            {isUser ? (
              message.content
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
