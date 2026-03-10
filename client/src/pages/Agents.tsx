import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Bot, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fetchAgents } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Agents() {
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2" data-testid="text-agents-title">Agent Team</h1>
            <p className="text-muted-foreground">Your OpenAI-powered BMad development team.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="glass-card border-none bg-card/40 p-6 h-48 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id} className="glass-card border-none bg-card/40 p-6 flex flex-col gap-4" data-testid={`card-agent-${agent.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl">
                        {agent.icon}
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground">{agent.title}</p>
                      </div>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-white/5 rounded-md" data-testid={`button-agent-settings-${agent.id}`}>
                      <Settings2 size={16} />
                    </button>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 italic">
                    "{agent.communicationStyle}"
                  </p>

                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">Capabilities:</span> {agent.capabilities}
                  </div>

                  {agent.menuCommands && (agent.menuCommands as any[]).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(agent.menuCommands as any[]).map((cmd: any) => (
                        <span key={cmd.trigger} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-muted-foreground font-mono border border-white/5">
                          {cmd.trigger}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md border border-white/5">
                      <span className="text-muted-foreground">Model:</span>
                      <span className="font-mono text-primary">{agent.model}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", agent.status === "active" ? "bg-green-500" : "bg-yellow-500")} />
                      <span className="capitalize text-muted-foreground">{agent.status}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
