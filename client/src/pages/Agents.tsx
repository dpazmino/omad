import { Layout } from "@/components/layout/Layout";
import { Bot, Plus, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const AGENTS = [
  {
    name: "Lead Architect",
    role: "System Design",
    description: "Expert in scalable architecture, system design, and technical decision making.",
    model: "gpt-4-turbo-preview",
    status: "active",
    avatar: "bg-blue-500"
  },
  {
    name: "Product Manager",
    role: "Requirements & Scope",
    description: "Focuses on user needs, feature scoping, and maintaining project vision.",
    model: "gpt-4-turbo-preview",
    status: "active",
    avatar: "bg-purple-500"
  },
  {
    name: "UX Designer",
    role: "User Experience",
    description: "Specializes in user journeys, interface patterns, and accessibility.",
    model: "gpt-4o",
    status: "active",
    avatar: "bg-pink-500"
  },
  {
    name: "Scrum Master",
    role: "Process & Delivery",
    description: "Manages agile workflows, unblocks team, and tracks progress.",
    model: "gpt-3.5-turbo",
    status: "standby",
    avatar: "bg-green-500"
  }
];

export default function Agents() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading font-bold mb-2">Agent Team</h1>
              <p className="text-muted-foreground">Manage your OpenAI-powered BMad development team.</p>
            </div>
            <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20">
              <Plus size={16} />
              Custom Agent
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AGENTS.map((agent) => (
              <Card key={agent.name} className="glass-card border-none bg-card/40 p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${agent.avatar} bg-opacity-20 flex items-center justify-center`}>
                      <Bot size={20} className={`text-${agent.avatar.split('-')[1]}-400`} />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                  <button className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-white/5 rounded-md">
                    <Settings2 size={16} />
                  </button>
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {agent.description}
                </p>

                <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md border border-white/5">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono text-primary">{agent.model}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="capitalize text-muted-foreground">{agent.status}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}