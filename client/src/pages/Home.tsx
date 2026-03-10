import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Send, Bot, User, Sparkles, Command, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAgents, fetchMessages, fetchSessions, createSession, streamChat, type StreamEvent } from "@/lib/api";
import type { Agent, ChatMessage, Session } from "@shared/schema";
import ReactMarkdown from "react-markdown";

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
        <header className="h-16 border-b border-border bg-white flex items-center px-6 justify-between shrink-0 sticky top-0 z-10" data-testid="chat-header">
          <div className="flex items-center gap-4">
            <h2 className="font-heading font-medium text-foreground">{activeSession?.title || "New Session"}</h2>
            <div className="flex gap-2 flex-wrap">
              <div className="relative group">
                <button
                  data-testid="button-agent-selector"
                  className="px-2 py-1 rounded-md bg-primary/8 text-primary text-xs font-medium flex items-center gap-1 hover:bg-primary/15 transition-colors border border-primary/10"
                >
                  <Bot size={12} />
                  {activeAgent ? `${activeAgent.icon} ${activeAgent.name}` : "Select Agent"}
                </button>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-border shadow-lg hidden group-hover:block z-50 py-1">
                  {agents.filter(a => a.status === "active").map(agent => (
                    <button
                      key={agent.id}
                      data-testid={`button-agent-${agent.id}`}
                      onClick={() => handleAgentSwitch(agent.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 transition-colors",
                        agent.id === activeAgent?.id && "bg-primary/8 text-primary"
                      )}
                    >
                      <span>{agent.icon}</span>
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
                  "px-2 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1",
                  partyMode
                    ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-muted text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <Sparkles size={12} />
                Party: {partyMode ? "On" : "Off"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="button-new-session"
              onClick={handleNewSession}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted px-3 py-1.5 rounded-md border border-border"
            >
              <Plus size={12} />
              New
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Claude Connected
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth" data-testid="chat-messages">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-sm">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2 text-foreground">BMad Method</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                {activeAgent
                  ? `${activeAgent.icon} ${activeAgent.name} (${activeAgent.title}) is ready. ${activeAgent.communicationStyle}`
                  : "Start a conversation with your AI development team."}
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {activeAgent?.menuCommands?.map((cmd: any) => (
                  <button
                    key={cmd.trigger}
                    data-testid={`button-command-${cmd.trigger}`}
                    onClick={() => setInput(cmd.trigger)}
                    className="px-3 py-1.5 text-xs bg-muted hover:bg-border border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="flex max-w-4xl mr-auto animate-in fade-in">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-xs text-muted-foreground font-medium ml-1">
                    {activeAgent ? `${activeAgent.icon} ${activeAgent.name} (${activeAgent.title})` : "Agent"}
                  </span>
                  <div className="bg-white px-5 py-3.5 rounded-2xl rounded-tl-sm border border-border shadow-sm max-w-[85%]">
                    <div className="prose prose-sm max-w-none">
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
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-xs text-muted-foreground font-medium ml-1">{pr.agentName}</span>
                  <div className="bg-white px-5 py-3.5 rounded-2xl rounded-tl-sm border border-border shadow-sm max-w-[85%]">
                    <div className="prose prose-sm max-w-none">
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
                <div className="w-8 h-8 rounded-lg bg-primary/60 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-sm border border-border shadow-sm flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 md:p-6 shrink-0 bg-white border-t border-border z-10">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group" data-testid="chat-form">
            <div className="relative flex items-end gap-2 bg-background border border-border rounded-xl p-2 shadow-sm transition-all duration-300 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
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
                  placeholder={activeAgent ? `Ask ${activeAgent.name} (${activeAgent.title})...` : "Start typing..."}
                  className="w-full max-h-32 min-h-[44px] bg-transparent border-none outline-none resize-none py-3 text-sm placeholder:text-muted-foreground focus:ring-0 text-foreground"
                  rows={1}
                  disabled={isStreaming}
                />
              </div>
              <button
                type="submit"
                data-testid="button-send"
                disabled={!input.trim() || isStreaming}
                className="w-10 h-10 shrink-0 rounded-lg bg-primary text-white flex items-center justify-center mb-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all duration-200"
              >
                {isStreaming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} className={cn("transition-transform duration-200", input.trim() && "translate-x-0.5 -translate-y-0.5")} />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  data-testid="button-help"
                  onClick={() => setInput("/bmad-help")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Command size={12} /> /bmad-help
                </button>
              </div>
              <div>Press <kbd className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] border border-border">Enter</kbd> to send</div>
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
        "flex max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "ml-auto" : "mr-auto"
      )}
    >
      <div className={cn("flex gap-4 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
          isUser
            ? "bg-muted border border-border"
            : "bg-primary text-white shadow-sm"
        )}>
          {isUser ? <User size={16} className="text-muted-foreground" /> : (
            agent ? <span className="text-sm">{agent.icon}</span> : <Bot size={16} />
          )}
        </div>
        <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
          {!isUser && message.agentName && (
            <span className="text-xs text-muted-foreground font-medium ml-1">{message.agentName}</span>
          )}
          <div className={cn(
            "px-5 py-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-white text-foreground rounded-tl-sm border border-border shadow-sm"
          )}>
            {isUser ? (
              message.content
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
