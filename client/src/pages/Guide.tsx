import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import {
  BookOpen, ArrowRight, MessageSquare, FolderKanban,
  Lightbulb, FileText, Layers, CheckCircle2, Users, Code2,
  Sparkles, ClipboardList, Merge, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMAND_DETAILS, type CommandDetail } from "@/lib/commandDetails";
import { CommandDetailModal } from "@/components/CommandDetailModal";

const STEPS = [
  {
    phase: "1. Analysis",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    icon: Lightbulb,
    iconColor: "text-blue-600",
    description: "Explore your idea and produce a structured product brief.",
    agent: "Mary (Business Analyst)",
    commands: [
      { trigger: "BP", name: "Brainstorm Project", detail: "Interactive brainstorming to explore your idea" },
      { trigger: "MR", name: "Market Research", detail: "Competitive landscape and market analysis" },
      { trigger: "CB", name: "Create Brief", detail: "Produces a structured product brief document" },
    ],
  },
  {
    phase: "2. Planning",
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: FileText,
    iconColor: "text-emerald-600",
    description: "Define product requirements and user experience.",
    agent: "John (Product Manager) & Sally (UX Designer)",
    commands: [
      { trigger: "CP", name: "Create PRD", detail: "Guided interview to produce your Product Requirements Document" },
      { trigger: "VP", name: "Validate PRD", detail: "Review and validate the PRD for completeness" },
      { trigger: "CU", name: "Create UX", detail: "Design the user experience and interaction flows" },
    ],
  },
  {
    phase: "3. Solutioning",
    color: "bg-violet-50 border-violet-200 text-violet-800",
    icon: Layers,
    iconColor: "text-violet-600",
    description: "Define architecture, then generate epics and stories for the Board.",
    agent: "Winston (Architect) & John (Product Manager)",
    commands: [
      { trigger: "CA", name: "Create Architecture", detail: "Document technical architecture decisions" },
      { trigger: "CE", name: "Create Epics & Stories", detail: "Generates epics and stories for your Board" },
      { trigger: "IR", name: "Implementation Readiness", detail: "Verify PRD, UX, and architecture are aligned" },
    ],
    highlight: true,
  },
  {
    phase: "4. Refinement",
    color: "bg-pink-50 border-pink-200 text-pink-800",
    icon: CheckCircle2,
    iconColor: "text-pink-600",
    description: "Sharpen the backlog with dependency mapping and INVEST quality checks.",
    agent: "Fred (Sprint Planner) & Allie (Story Coach)",
    commands: [
      { trigger: "FD", name: "Find Dependencies", detail: "Fred maps cross-story dependencies and sequencing" },
      { trigger: "IN", name: "INVEST Review", detail: "Allie scores stories against the INVEST framework" },
      { trigger: "SP", name: "Sprint Planning", detail: "Fred builds sprints from the refined backlog" },
    ],
  },
  {
    phase: "5. Implementation",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    icon: Code2,
    iconColor: "text-amber-600",
    description: "Move stories to In Progress and generate implementation prompts in the Dev View.",
    agent: "Bob (Scrum Master) & DevAI (Developer)",
    commands: [
      { trigger: "CS", name: "Context Story", detail: "Prepare a story with full implementation context" },
      { trigger: "DS", name: "Dev Story", detail: "Write tests and code outline for a specific story" },
    ],
  },
];

export default function Guide() {
  const [activeCommand, setActiveCommand] = useState<CommandDetail | null>(null);

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
              <BookOpen size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-guide-title">
                How to Use BMad
              </h1>
              <p className="text-xs text-muted-foreground">
                Step-by-step guide to the BMad Method workflow
              </p>
            </div>
          </div>

          <div className="mt-6 bg-card p-5 rounded-md border border-border" data-testid="section-quick-start">
            <h2 className="text-sm font-semibold text-foreground mb-3">Quick Start</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-start gap-2.5 p-3 rounded bg-muted/50 border border-border">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Create a Project</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Go to <Link href="/projects" className="text-primary underline">Projects</Link> and create a new project.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded bg-muted/50 border border-border">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Use Chat Commands</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Inside your project, use the <MessageSquare size={10} className="inline" /> Chat tab to run commands.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded bg-muted/50 border border-border">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">View Your Board</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    After running <strong>CE</strong>, switch to the <FolderKanban size={10} className="inline" /> Board tab.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-card p-5 rounded-md border border-primary/15" data-testid="section-board-explained">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban size={14} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">When Do Stories Appear on the Board?</h2>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                The <strong className="text-foreground">Board</strong> tab shows epics, stories, and sprints. Here's how stories get there:
              </p>
              <div className="bg-muted/50 rounded p-3 space-y-1.5 border border-border">
                <div className="flex items-start gap-1.5">
                  <ArrowRight size={10} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 1:</strong> Complete Analysis — run <code className="bg-muted px-1 py-0.5 rounded text-[10px]">BP</code> and <code className="bg-muted px-1 py-0.5 rounded text-[10px]">CB</code></p>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight size={10} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 2:</strong> Run <code className="bg-muted px-1 py-0.5 rounded text-[10px]">CP</code> to generate product requirements</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight size={10} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 3:</strong> Run <code className="bg-muted px-1 py-0.5 rounded text-[10px]">CA</code> to define architecture</p>
                </div>
                <div className="flex items-start gap-1.5 bg-primary/5 -mx-1 px-1 py-1 rounded">
                  <ArrowRight size={10} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-primary">Step 4:</strong> Run <code className="bg-primary/10 text-primary px-1 py-0.5 rounded text-[10px] font-semibold">CE</code> — generates epics and stories</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight size={10} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 5:</strong> Go to the <strong className="text-foreground">Board</strong> tab and click <strong className="text-foreground">"Import from Documents"</strong>. Re-importing clears old stories and brings in the latest.</p>
                </div>
              </div>
              <p>
                Once imported, use <code className="bg-muted px-1 py-0.5 rounded text-[10px]">FD</code> and <code className="bg-muted px-1 py-0.5 rounded text-[10px]">IN</code> to refine the backlog, then create <strong className="text-foreground">sprints</strong> and move stories into <strong className="text-foreground">In Progress</strong> to work them in the Dev View.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3" data-testid="section-phases">
            <h2 className="text-sm font-semibold text-foreground">The 5 BMad Phases</h2>
            <p className="text-xs text-muted-foreground">
              Follow these phases in order. Each command builds on documents from previous steps.
            </p>

            {STEPS.map((step, i) => (
              <div
                key={step.phase}
                className={cn(
                  "rounded-md border p-4",
                  step.highlight ? "border-primary/20 bg-primary/3" : "border-border bg-card"
                )}
                data-testid={`section-phase-${i + 1}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-7 h-7 rounded flex items-center justify-center", step.color)}>
                    <step.icon size={14} className={step.iconColor} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{step.phase}</h3>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users size={9} /> {step.agent}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                <div className="space-y-1">
                  {step.commands.map((cmd) => {
                    const detail = COMMAND_DETAILS[cmd.trigger];
                    return (
                      <button
                        key={cmd.trigger}
                        data-testid={`button-guide-command-${cmd.trigger}`}
                        onClick={() => detail && setActiveCommand(detail)}
                        disabled={!detail}
                        className="w-full flex items-center gap-2 text-xs text-left px-1.5 py-1 rounded hover:bg-primary/5 transition-colors disabled:cursor-default"
                      >
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-foreground w-7 text-center shrink-0">
                          {cmd.trigger}
                        </code>
                        <span className="font-medium text-foreground">{cmd.name}</span>
                        <span className="text-muted-foreground text-[10px] hidden sm:inline flex-1 truncate">— {cmd.detail}</span>
                        {detail && <Info size={10} className="text-muted-foreground/60 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {step.highlight && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary font-medium bg-primary/5 px-2.5 py-1.5 rounded">
                    <FolderKanban size={11} />
                    The CE command generates stories for your Board
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 bg-card p-5 rounded-md border border-border" data-testid="section-refinement-agents">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Refinement Agents: Fred & Allie</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-indigo-700 text-white text-[10px] font-semibold flex items-center justify-center">F</div>
                  <p className="font-medium text-foreground">Fred — Sprint Planning</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Maps dependencies between stories, flags blockers, and builds balanced sprints from the backlog.
                </p>
              </div>
              <div className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-pink-700 text-white text-[10px] font-semibold flex items-center justify-center">A</div>
                  <p className="font-medium text-foreground">Allie — Story Coach</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Scores each story against the INVEST framework (Independent, Negotiable, Valuable, Estimable, Small, Testable) and suggests rewrites.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-card p-5 rounded-md border border-border" data-testid="section-dev-view">
            <div className="flex items-center gap-2 mb-2">
              <Code2 size={14} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Dev View</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Dev View is where in-progress stories get implementation briefs. Open it from the tabs inside a project, or move any story to <strong className="text-foreground">In Progress</strong> on the Board to surface it here.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={11} className="text-primary" />
                  <p className="font-medium text-foreground">Generate Prompt</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Produces a detailed implementation brief for a single story — context, approach, and gotchas. Not code; a task brief you hand to a developer or coding AI.
                </p>
              </div>
              <div className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <ClipboardList size={11} className="text-primary" />
                  <p className="font-medium text-foreground">Aggregate Prompts</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Synthesizes several story prompts into one coherent brief, respecting dependencies — good for handing off a batch of related work at once.
                </p>
              </div>
              <div className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <Merge size={11} className="text-primary" />
                  <p className="font-medium text-foreground">Duplicates</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Finds overlapping stories so you can merge them before generating prompts.
                </p>
              </div>
              <div className="p-3 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Priority Icons</p>
                <p className="text-[10px] text-muted-foreground">
                  <span className="text-red-500">▲</span> critical,
                  <span className="text-orange-500"> ↑</span> high,
                  <span className="text-yellow-600"> –</span> medium,
                  <span className="text-blue-500"> ↓</span> low.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-card p-5 rounded-md border border-border" data-testid="section-board-features">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban size={14} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Board Features</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Epics View</p>
                <p className="text-[10px] text-muted-foreground">Expandable epic list showing stories grouped under each epic.</p>
              </div>
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Kanban Board</p>
                <p className="text-[10px] text-muted-foreground">5-column board (Backlog, To Do, In Progress, Review, Done).</p>
              </div>
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Sprint Management</p>
                <p className="text-[10px] text-muted-foreground">Create sprints, assign stories, and filter the board by sprint.</p>
              </div>
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Import from Documents</p>
                <p className="text-[10px] text-muted-foreground">Parses the CE document into epics and stories. Re-importing clears the old set and brings in the latest.</p>
              </div>
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Story Details</p>
                <p className="text-[10px] text-muted-foreground">Description, acceptance criteria, status, priority, points, and dependencies.</p>
              </div>
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Documents Panel</p>
                <p className="text-[10px] text-muted-foreground">Side panel with all generated docs — Brief, PRD, UX, Architecture, Epics. Auto-scrolls to top when switching docs.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
