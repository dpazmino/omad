import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import {
  BookOpen, ArrowRight, MessageSquare, FolderKanban,
  Lightbulb, FileText, Layers, CheckCircle2, Users
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    phase: "1. Analysis",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    icon: Lightbulb,
    iconColor: "text-blue-600",
    description: "Start by brainstorming and researching your product idea.",
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
    description: "Define your product requirements and user experience.",
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
    description: "Define architecture, then generate your epics and stories for the Board.",
    agent: "Winston (Architect) & John (Product Manager)",
    commands: [
      { trigger: "CA", name: "Create Architecture", detail: "Document technical architecture decisions" },
      { trigger: "CE", name: "Create Epics & Stories", detail: "Generates epics and stories for your Board" },
      { trigger: "IR", name: "Implementation Readiness", detail: "Verify PRD, UX, and architecture are aligned" },
    ],
    highlight: true,
  },
  {
    phase: "4. Implementation",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    icon: CheckCircle2,
    iconColor: "text-amber-600",
    description: "Plan sprints, prepare stories, and track development work on the Board.",
    agent: "Bob (Scrum Master) & DevAI (Developer)",
    commands: [
      { trigger: "SP", name: "Sprint Planning", detail: "Create sprints and assign stories from your Board" },
      { trigger: "CS", name: "Context Story", detail: "Prepare a story with full implementation context" },
      { trigger: "DS", name: "Dev Story", detail: "Write tests and code for a specific story" },
    ],
  },
];

export default function Guide() {
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
                  <p><strong className="text-foreground">Step 5:</strong> Go to <strong className="text-foreground">Board</strong> tab and click <strong className="text-foreground">"Import from Documents"</strong></p>
                </div>
              </div>
              <p>
                Once imported, create <strong className="text-foreground">sprints</strong>, drag stories, set priorities, and assign points.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3" data-testid="section-phases">
            <h2 className="text-sm font-semibold text-foreground">The 4 BMad Phases</h2>
            <p className="text-xs text-muted-foreground">
              Follow these phases in order. Each command may require documents from previous steps.
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
                  {step.commands.map((cmd) => (
                    <div key={cmd.trigger} className="flex items-center gap-2 text-xs">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-foreground w-7 text-center shrink-0">
                        {cmd.trigger}
                      </code>
                      <span className="font-medium text-foreground">{cmd.name}</span>
                      <span className="text-muted-foreground text-[10px] hidden sm:inline">— {cmd.detail}</span>
                    </div>
                  ))}
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
                <p className="text-[10px] text-muted-foreground">Create sprints, assign stories, and filter the board.</p>
              </div>
              <div className="p-2.5 rounded bg-muted/50 border border-border">
                <p className="font-medium text-foreground mb-0.5">Story Details</p>
                <p className="text-[10px] text-muted-foreground">Full description, acceptance criteria, status, priority, and points.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
