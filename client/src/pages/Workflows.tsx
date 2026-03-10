import { Layout } from "@/components/layout/Layout";
import { GitBranch, Play, CheckCircle2, Circle, Clock, ArrowRight } from "lucide-react";

const BMAD_PHASES = [
  {
    id: "analysis",
    title: "1. Analysis",
    description: "Research, brainstorm, and define your product brief. The Business Analyst leads discovery with market research, domain expertise, and competitive analysis.",
    status: "available",
    agents: ["📊 Mary (Business Analyst)"],
    commands: [
      { trigger: "BP", name: "Brainstorm Project" },
      { trigger: "MR", name: "Market Research" },
      { trigger: "DR", name: "Domain Research" },
      { trigger: "TR", name: "Technical Research" },
      { trigger: "CB", name: "Create Brief" },
    ]
  },
  {
    id: "planning",
    title: "2. Planning",
    description: "Create your PRD and UX design. The Product Manager drives requirements while the UX Designer shapes the user experience.",
    status: "available",
    agents: ["📋 John (Product Manager)", "🎨 Sally (UX Designer)"],
    commands: [
      { trigger: "CP", name: "Create PRD" },
      { trigger: "VP", name: "Validate PRD" },
      { trigger: "EP", name: "Edit PRD" },
      { trigger: "CU", name: "Create UX Design" },
    ]
  },
  {
    id: "solutioning",
    title: "3. Solutioning",
    description: "Define architecture, create epics and stories, and verify implementation readiness. The Architect and PM collaborate on technical decisions.",
    status: "available",
    agents: ["🏗️ Winston (Lead Architect)", "📋 John (Product Manager)"],
    commands: [
      { trigger: "CA", name: "Create Architecture" },
      { trigger: "CE", name: "Create Epics & Stories" },
      { trigger: "IR", name: "Implementation Readiness Check" },
    ]
  },
  {
    id: "implementation",
    title: "4. Implementation",
    description: "Sprint planning, development, code review, and QA. The full team collaborates to ship working software.",
    status: "available",
    agents: ["🏃 Bob (Scrum Master)", "💻 DevAI (Developer)", "🧪 Quinn (QA Engineer)"],
    commands: [
      { trigger: "SP", name: "Sprint Planning" },
      { trigger: "CS", name: "Context Story" },
      { trigger: "DS", name: "Dev Story" },
      { trigger: "CR", name: "Code Review" },
      { trigger: "QA", name: "QA Automate" },
      { trigger: "CC", name: "Course Correction" },
      { trigger: "ER", name: "Epic Retrospective" },
    ]
  }
];

export default function Workflows() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2" data-testid="text-workflows-title">BMad Workflows</h1>
            <p className="text-muted-foreground">
              The BMad Method guides you through a structured agile process from idea to deployment. Each phase has specialized agents and commands.
            </p>
          </div>

          {/* Phase flow visualization */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {BMAD_PHASES.map((phase, idx) => (
              <div key={phase.id} className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium whitespace-nowrap border border-primary/20">
                  {phase.title}
                </div>
                {idx < BMAD_PHASES.length - 1 && (
                  <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {BMAD_PHASES.map((phase) => (
              <div key={phase.id} className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group" data-testid={`card-phase-${phase.id}`}>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <GitBranch size={18} className="text-primary" />
                    </div>
                    <h3 className="text-xl font-heading font-semibold">{phase.title}</h3>
                  </div>

                  <p className="text-sm text-muted-foreground ml-12">
                    {phase.description}
                  </p>

                  <div className="ml-12 space-y-3">
                    <div className="text-xs font-medium text-foreground">Agents:</div>
                    <div className="flex flex-wrap gap-2">
                      {phase.agents.map(agent => (
                        <span key={agent} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs border border-primary/20">
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ml-12 space-y-3">
                    <div className="text-xs font-medium text-foreground">Commands:</div>
                    <div className="flex flex-wrap gap-2">
                      {phase.commands.map(cmd => (
                        <span key={cmd.trigger} className="px-2.5 py-1.5 rounded-md bg-white/5 text-xs text-muted-foreground border border-white/5 hover:border-primary/30 hover:text-foreground transition-colors cursor-default" data-testid={`text-command-${cmd.trigger}`}>
                          <span className="font-mono text-primary mr-1">{cmd.trigger}</span>
                          {cmd.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/5">
            <h3 className="font-heading font-semibold mb-3">Getting Started</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Go to the <span className="text-primary">Chat</span> page and start a new session</p>
              <p>2. Select an agent using the agent dropdown (or use Party Mode for multi-agent collaboration)</p>
              <p>3. Type a command trigger (like <span className="font-mono text-primary">BP</span>) or ask questions naturally</p>
              <p>4. Use <span className="font-mono text-primary">/bmad-help</span> anytime for guidance on what to do next</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
