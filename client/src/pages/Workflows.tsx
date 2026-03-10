import { Layout } from "@/components/layout/Layout";
import { GitBranch, Play, CheckCircle2, Circle, Clock } from "lucide-react";

const WORKFLOWS = [
  {
    id: "wf-1",
    title: "Discovery & Ideation",
    description: "Creative Intelligence Suite (CIS) workflow for brainstorming and defining core product vision.",
    status: "completed",
    steps: ["Market Analysis", "User Personas", "Feature Brainstorm"]
  },
  {
    id: "wf-2",
    title: "Architecture Planning",
    description: "Define system architecture, tech stack, and data models with the Lead Architect.",
    status: "in-progress",
    steps: ["Tech Stack Selection", "Database Schema", "API Design", "Security Review"]
  },
  {
    id: "wf-3",
    title: "Sprint Implementation",
    description: "Execute development loop with Developer and Scrum Master agents.",
    status: "pending",
    steps: ["Setup Repo", "Implement Core Auth", "Build UI Components"]
  }
];

export default function Workflows() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">BMad Workflows</h1>
            <p className="text-muted-foreground">Structured agile processes guided by AI agents.</p>
          </div>

          <div className="space-y-6">
            {WORKFLOWS.map((workflow) => (
              <div key={workflow.id} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                {/* Status indicator line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  workflow.status === 'completed' ? 'bg-green-500' : 
                  workflow.status === 'in-progress' ? 'bg-primary' : 'bg-muted'
                }`} />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <GitBranch size={18} className={
                          workflow.status === 'completed' ? 'text-green-400' : 
                          workflow.status === 'in-progress' ? 'text-primary' : 'text-muted-foreground'
                        } />
                      </div>
                      <h3 className="text-xl font-heading font-semibold">{workflow.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground ml-12">
                      {workflow.description}
                    </p>

                    <div className="mt-6 ml-12 space-y-3">
                      {workflow.steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          {workflow.status === 'completed' || (workflow.status === 'in-progress' && idx === 0) ? (
                            <CheckCircle2 size={16} className="text-green-500" />
                          ) : workflow.status === 'in-progress' && idx === 1 ? (
                            <div className="relative flex items-center justify-center w-4 h-4">
                              <div className="absolute w-full h-full border-2 border-primary rounded-full border-t-transparent animate-spin" />
                            </div>
                          ) : (
                            <Circle size={16} className="text-muted" />
                          )}
                          <span className={
                            workflow.status === 'completed' || (workflow.status === 'in-progress' && idx === 0)
                              ? "text-foreground line-through opacity-50"
                              : workflow.status === 'in-progress' && idx === 1
                                ? "text-primary font-medium"
                                : "text-muted-foreground"
                          }>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center md:flex-col gap-3 justify-end md:justify-start">
                    {workflow.status === 'in-progress' ? (
                      <button className="flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center">
                        <Play size={16} className="fill-current" />
                        Continue
                      </button>
                    ) : workflow.status === 'pending' ? (
                      <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center border border-white/10">
                        <Play size={16} />
                        Start Phase
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 text-sm text-green-400 bg-green-500/10 rounded-lg w-full justify-center border border-green-500/20">
                        <CheckCircle2 size={16} />
                        Finished
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}