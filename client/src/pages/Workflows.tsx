import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { GitBranch, ArrowRight, Info } from "lucide-react";
import { COMMAND_DETAILS, type CommandDetail } from "@/lib/commandDetails";
import { CommandDetailModal } from "@/components/CommandDetailModal";

const BMAD_PHASES = [
  {
    id: "analysis",
    title: "1. Analysis",
    description: "Research, brainstorm, and define your product brief. The Business Analyst leads discovery with market research, domain expertise, and competitive analysis.",
    agents: ["Mary (Business Analyst)"],
    commands: ["BP", "MR", "DR", "TR", "CB"],
  },
  {
    id: "planning",
    title: "2. Planning",
    description: "Create your PRD and UX design. The Product Manager drives requirements while the UX Designer shapes the user experience.",
    agents: ["John (Product Manager)", "Sally (UX Designer)"],
    commands: ["CP", "VP", "EP", "CU"],
  },
  {
    id: "solutioning",
    title: "3. Solutioning",
    description: "Define architecture, create epics and stories, and verify implementation readiness. The Architect and PM collaborate on technical decisions.",
    agents: ["Winston (Lead Architect)", "John (Product Manager)"],
    commands: ["CA", "CE", "IR"],
  },
  {
    id: "refinement",
    title: "4. Refinement",
    description: "Refine the backlog with dependency mapping and INVEST quality checks, then plan sprints. Fred sequences work; Allie sharpens the stories.",
    agents: ["Fred (Sprint Planner)", "Allie (Story Coach)"],
    commands: ["FD", "IN", "SP"],
  },
  {
    id: "implementation",
    title: "5. Implementation",
    description: "Context handoff, development, code review, QA, and retrospectives. The team ships working software and learns from each epic.",
    agents: ["Bob (Scrum Master)", "DevAI (Developer)", "Quinn (QA Engineer)"],
    commands: ["CS", "DS", "CR", "QA", "CC", "ER"],
  },
];

export default function Workflows() {
  const [activeCommand, setActiveCommand] = useState<CommandDetail | null>(null);

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-workflows-title">BMad Workflows</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Structured agile process from idea to deployment. Each phase has specialized agents and commands.{" "}
              <span className="inline-flex items-center gap-1 text-primary"><Info size={11} /> Click any command to see details and an example.</span>
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

                  <p className="text-xs text-muted-foreground">{phase.description}</p>

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
                      {phase.commands.map(trigger => {
                        const cmd = COMMAND_DETAILS[trigger];
                        if (!cmd) return null;
                        return (
                          <button
                            key={trigger}
                            data-testid={`button-command-${trigger}`}
                            onClick={() => setActiveCommand(cmd)}
                            className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground border border-border hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors cursor-pointer"
                          >
                            <span className="font-mono text-primary font-medium mr-1">{cmd.trigger}</span>
                            {cmd.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card p-5 rounded-md border border-border">
            <h3 className="text-sm font-semibold mb-2 text-foreground">Getting Started</h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>1. Go to <span className="text-primary font-medium">Projects</span> and create a new project</p>
              <p>2. Open the project and go to the <span className="text-primary font-medium">Chat</span> tab</p>
              <p>3. Type a command trigger (like <span className="font-mono text-primary font-medium">BP</span>) or ask questions naturally</p>
              <p>4. Click any command above to see what it does and when to use it</p>
            </div>
          </div>
        </div>
      </div>

      <CommandDetailModal command={activeCommand} onClose={() => setActiveCommand(null)} />
    </Layout>
  );
}
