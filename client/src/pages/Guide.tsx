import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import {
  BookOpen, ArrowRight, MessageSquare, FolderKanban, GitBranch,
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
    color: "bg-purple-50 border-purple-200 text-purple-800",
    icon: Layers,
    iconColor: "text-purple-600",
    description: "Define architecture, then generate your epics and stories for the Board.",
    agent: "Winston (Architect) & John (Product Manager)",
    commands: [
      { trigger: "CA", name: "Create Architecture", detail: "Document technical architecture decisions" },
      { trigger: "CE", name: "Create Epics & Stories", detail: "Generates epics and stories — these populate your Board" },
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
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground" data-testid="text-guide-title">
                How to Use BMad
              </h1>
              <p className="text-sm text-muted-foreground">
                A step-by-step guide to the BMad Method workflow
              </p>
            </div>
          </div>

          <div className="mt-8 glass-card p-6 rounded-xl" data-testid="section-quick-start">
            <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Quick Start</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Create a Project</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Go to <Link href="/projects" className="text-primary underline">Projects</Link> and create a new project for your product idea.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Use Chat Commands</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inside your project, use the <MessageSquare size={12} className="inline" /> Chat tab to run commands with AI agents.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">View Your Board</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    After running <strong>CE</strong> (Create Epics), switch to the <FolderKanban size={12} className="inline" /> Board tab to see your stories.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 glass-card p-6 rounded-xl border-2 border-primary/20" data-testid="section-board-explained">
            <div className="flex items-center gap-2 mb-3">
              <FolderKanban size={20} className="text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">When Do Stories Appear on the Board?</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                The <strong className="text-foreground">Board</strong> tab inside each project is your Jira-like project management view. It shows epics, stories, and sprints. Here's how stories get there:
              </p>
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <ArrowRight size={14} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 1:</strong> Complete the Analysis phase — run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">BP</code> (Brainstorm) and <code className="bg-muted px-1.5 py-0.5 rounded text-xs">CB</code> (Create Brief)</p>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight size={14} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 2:</strong> Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">CP</code> (Create PRD) to generate your product requirements</p>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight size={14} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 3:</strong> Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">CA</code> (Create Architecture) to define technical decisions</p>
                </div>
                <div className="flex items-start gap-2 bg-primary/5 -mx-1 px-1 py-1 rounded">
                  <ArrowRight size={14} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-primary">Step 4:</strong> Run <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-semibold">CE</code> (Create Epics & Stories) — this is the command that generates your epics and stories</p>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight size={14} className="text-primary mt-0.5 shrink-0" />
                  <p><strong className="text-foreground">Step 5:</strong> Go to the <strong className="text-foreground">Board</strong> tab and click <strong className="text-foreground">"Import from Documents"</strong> to pull the epics and stories into your board</p>
                </div>
              </div>
              <p>
                Once imported, you can create <strong className="text-foreground">sprints</strong>, drag stories between statuses, set priorities, and assign story points — just like Jira.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-4" data-testid="section-phases">
            <h2 className="text-lg font-heading font-semibold text-foreground">The 4 BMad Phases</h2>
            <p className="text-sm text-muted-foreground">
              Follow these phases in order. Each command may require documents from previous steps — the app will let you know if prerequisites are missing.
            </p>

            {STEPS.map((step, i) => (
              <div
                key={step.phase}
                className={cn(
                  "rounded-xl border p-5",
                  step.highlight ? "border-primary/30 bg-primary/3" : "border-border bg-white"
                )}
                data-testid={`section-phase-${i + 1}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", step.color)}>
                    <step.icon size={18} className={step.iconColor} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground">{step.phase}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users size={10} /> {step.agent}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                <div className="space-y-1.5">
                  {step.commands.map((cmd) => (
                    <div key={cmd.trigger} className="flex items-center gap-3 text-sm">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono font-semibold text-foreground w-8 text-center shrink-0">
                        {cmd.trigger}
                      </code>
                      <span className="font-medium text-foreground">{cmd.name}</span>
                      <span className="text-muted-foreground text-xs hidden sm:inline">— {cmd.detail}</span>
                    </div>
                  ))}
                </div>
                {step.highlight && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium bg-primary/5 px-3 py-2 rounded-lg">
                    <FolderKanban size={14} />
                    The CE command here is what generates stories for your Board
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 glass-card p-6 rounded-xl" data-testid="section-board-features">
            <div className="flex items-center gap-2 mb-3">
              <FolderKanban size={20} className="text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">Board Features</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground mb-1">Epics View</p>
                <p className="text-xs text-muted-foreground">Expandable epic list showing stories grouped under each epic with status and priority badges.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground mb-1">Kanban Board</p>
                <p className="text-xs text-muted-foreground">5-column board (Backlog → To Do → In Progress → Review → Done) with story cards.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground mb-1">Sprint Management</p>
                <p className="text-xs text-muted-foreground">Create sprints, assign stories to sprints, and filter the board by sprint.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-foreground mb-1">Story Details</p>
                <p className="text-xs text-muted-foreground">Click any story to see full description, acceptance criteria, and update status/priority/points.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
