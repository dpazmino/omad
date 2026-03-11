import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fetchAgents } from "@/lib/api";
import { cn } from "@/lib/utils";

const AGENT_COLORS: Record<string, string> = {
  Winston: "bg-primary text-white",
  John: "bg-blue-700 text-white",
  Mary: "bg-teal-700 text-white",
  Sally: "bg-violet-700 text-white",
  Bob: "bg-amber-700 text-white",
  DevAI: "bg-emerald-700 text-white",
  Quinn: "bg-rose-700 text-white",
  Fred: "bg-indigo-700 text-white",
};

export default function Agents() {
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-agents-title">Agent Team</h1>
            <p className="text-sm text-muted-foreground mt-1">AI-powered development team members.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="bg-card border border-border p-5 h-44 animate-pulse rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => {
                const initials = agent.name.slice(0, 2).toUpperCase();
                const colorClass = AGENT_COLORS[agent.name] || "bg-primary text-white";
                return (
                  <Card key={agent.id} className="bg-card border border-border p-5 flex flex-col gap-3 rounded-md hover:border-primary/20 transition-colors" data-testid={`card-agent-${agent.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded flex items-center justify-center text-xs font-semibold", colorClass)}>
                          {initials}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                          <p className="text-xs text-muted-foreground">{agent.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full", agent.status === "active" ? "bg-green-500" : "bg-yellow-500")} />
                        <span className="text-[10px] text-muted-foreground capitalize">{agent.status}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      {agent.capabilities}
                    </p>

                    {agent.menuCommands && (agent.menuCommands as any[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(agent.menuCommands as any[]).map((cmd: any) => (
                          <span key={cmd.trigger} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono border border-border">
                            {cmd.trigger}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-mono text-foreground">{agent.model}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
