import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Send, Bot, User, Sparkles, Command } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent?: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "system",
    content: "BMad Method initialized. OpenAI engine active. Type /bmad-help for commands.",
  },
  {
    id: "2",
    role: "assistant",
    content: "Hello! I'm the BMad Lead Architect. I'm here to help you design and build your application using the BMad Method powered by OpenAI. What are we building today?",
    agent: "Lead Architect"
  }
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Mock AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I've analyzed your request using the BMad framework. Before we proceed with the architecture, should we loop in the UX Designer or Product Manager to discuss user journeys?",
          agent: "Lead Architect"
        }
      ]);
    }, 1500);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-screen relative">
        {/* Header */}
        <header className="h-16 border-b border-border/50 glass-panel flex items-center px-6 justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-heading font-medium">Project Session</h2>
            <div className="flex gap-2">
              <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium flex items-center gap-1">
                <Bot size={12} />
                Lead Architect
              </span>
              <span className="px-2 py-1 rounded-md bg-white/5 text-muted-foreground text-xs font-medium border border-border">
                Party Mode: Off
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-black/20 px-3 py-1.5 rounded-full border border-border/50">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              OpenAI Connected
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === "user" ? "ml-auto" : "mr-auto",
                msg.role === "system" && "mx-auto text-center"
              )}
            >
              {msg.role === "system" ? (
                <div className="px-4 py-2 rounded-full bg-white/5 border border-border/50 text-xs text-muted-foreground flex items-center gap-2">
                  <Command size={12} />
                  {msg.content}
                </div>
              ) : (
                <div className={cn(
                  "flex gap-4 items-start",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                    msg.role === "user" 
                      ? "bg-secondary" 
                      : "bg-gradient-to-br from-primary/80 to-accent/80 text-white shadow-lg shadow-primary/20"
                  )}>
                    {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col gap-1",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}>
                    {msg.role === "assistant" && (
                      <span className="text-xs text-muted-foreground font-medium ml-1">
                        {msg.agent}
                      </span>
                    )}
                    <div className={cn(
                      "px-5 py-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-sm" 
                        : "glass-card text-foreground rounded-tl-sm border border-white/5"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex max-w-4xl mr-auto animate-in fade-in">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-primary/10">
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

        {/* Input Area */}
        <div className="p-4 md:p-6 shrink-0 glass-panel border-t border-border/50 z-10">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-end gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-2xl transition-all duration-300 focus-within:border-primary/50 focus-within:bg-black/60">
              <div className="flex-1 pl-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder="Ask the Lead Architect or type /bmad-help..."
                  className="w-full max-h-32 min-h-[44px] bg-transparent border-none outline-none resize-none py-3 text-sm placeholder:text-muted-foreground focus:ring-0"
                  rows={1}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center mb-1 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 transition-all duration-200"
              >
                <Send size={16} className={cn("transition-transform duration-200", input.trim() && "translate-x-0.5 -translate-y-0.5")} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-3">
                <button type="button" className="hover:text-primary transition-colors flex items-center gap-1">
                  <Command size={12} /> /bmad-help
                </button>
                <button type="button" className="hover:text-primary transition-colors flex items-center gap-1">
                  <Sparkles size={12} /> Party Mode
                </button>
              </div>
              <div>Press <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded text-[10px]">Enter</kbd> to send</div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}