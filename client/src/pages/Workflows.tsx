import { Layout } from "@/components/layout/Layout";
import { GitBranch, ArrowRight } from "lucide-react";

const BMAD_PHASES = [
  {
    id: "analysis",
    title: "1. Analysis",
    description: "Research, brainstorm, and define your product brief. The Business Analyst leads discovery with market research, domain expertise, and competitive analysis.",
    status: "available",
    agents: ["Mary (Business Analyst)"],
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
    agents: ["John (Product Manager)", "Sally (UX Designer)"],
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
    agents: ["Winston (Lead Architect)", "John (Product Manager)"],
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
    agents: ["Bob (Scrum Master)", "DevAI (Developer)", "Quinn (QA Engineer)"],
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
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-workflows-title">BMad Workflows</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Structured agile process from idea to deployment. Each phase has specialized agents and commands.
            </p>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {BMAD_PHASES.map((phase, idx) => (
              <div key={phase.id} className="flex items-center gap-1">
                <div className="px-2 py-1 rounded bg-primary/8 text-primary text-[11px] font-medium whitespace-nowrap border border-primary/10">
                  {phase.title}
                </div>
                {idx < BMAD_PHASES.length - 1 && (
                  <ArrowRight size={10} className="text-muted-foreground/50 shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {BMAD_PHASES.map((phase) => (
              <div key={phase.id} className="bg-card p-5 rounded-md border border-border relative" data-testid={`card-phase-${phase.id}`}>
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l" />

                <div className="space-y-3 pl-3">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {phase.description}
                  </p>

                  <div className="space-y-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Agents</div>
                    <div className="flex flex-wrap gap-1.5">
                      {phase.agents.map(agent => (
                        <span key={agent} className="px-2 py-0.5 rounded bg-muted text-xs text-foreground border border-border">
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Commands</div>
                    <div className="flex flex-wrap gap-1.5">
                      {phase.commands.map(cmd => (
                        <span key={cmd.trigger} className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground border border-border" data-testid={`text-command-${cmd.trigger}`}>
                          <span className="font-mono text-primary font-medium mr-1">{cmd.trigger}</span>
                          {cmd.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card p-5 rounded-md border border-border">
            <h3 className="text-sm font-semibold mb-2 text-foreground">Getting Started</h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>1. Go to the <span className="text-primary font-medium">Chat</span> page and start a new session</p>
              <p>2. Select an agent using the agent dropdown</p>
              <p>3. Type a command trigger (like <span className="font-mono text-primary font-medium">BP</span>) or ask questions naturally</p>
              <p>4. Use <span className="font-mono text-primary font-medium">/bmad-help</span> anytime for guidance</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
