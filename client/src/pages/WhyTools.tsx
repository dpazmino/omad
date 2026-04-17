import { Layout } from "@/components/layout/Layout";
import {
  AlertTriangle,
  Brain,
  GitBranch,
  FileText,
  ListChecks,
  TrendingDown,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Target,
  Layers,
  Zap,
} from "lucide-react";

const TOOLS = [
  {
    id: "bmad",
    name: "BMad Method",
    tagline: "Structured agile workflow with specialist AI agents",
    icon: GitBranch,
    accent: "bg-primary text-primary-foreground",
    accentSoft: "bg-primary/10 text-primary border-primary/20",
    description:
      "BMad breaks software delivery into five disciplined phases — Analysis, Planning, Solutioning, Refinement, and Implementation — each driven by a specialist agent (Mary, John, Winston, Sally, Fred, Allie, Bob, DevAI, Quinn). Instead of one generalist AI guessing across all roles, BMad routes each decision to the right expert with the right system prompt and the right artifacts in context.",
    solves: [
      "Single-agent confusion when one AI tries to be PM, architect, and developer at once.",
      "Lost institutional knowledge between sessions — agents work from durable documents, not stale chat history.",
      "Skipped discovery — the workflow forces a Brief and PRD before any architecture or code is written.",
      "Story-level chaos — the CE command produces parseable epics and INVEST-graded stories that flow straight into the board.",
    ],
    when: "When you want a senior team's process — discovery, planning, design, refinement, build — without hiring six people.",
  },
  {
    id: "openspec",
    name: "OpenSpec",
    tagline: "Specifications as the source of truth, not chat",
    icon: FileText,
    accent: "bg-violet-700 text-white",
    accentSoft: "bg-violet-500/10 text-violet-700 border-violet-500/20",
    description:
      "OpenSpec is a spec-driven development pattern where every change starts as a written specification — proposal, capability deltas, tasks, and design — that humans review before any code is generated. The spec is the contract; the AI implements against it. Specs are versioned, diff-able, and live next to the code they describe.",
    solves: [
      "Underspecified prompts that produce code the team didn't actually agree to.",
      "Drift between intent and implementation — the spec stays in the repo as the durable source of truth.",
      "Reviewer overload — humans review a tight spec, not 2,000 lines of generated code.",
      "Knowledge transfer — new contributors (human or AI) onboard from specs, not from reading every commit.",
    ],
    when: "When changes are non-trivial, cross multiple files, or need architectural buy-in before code is written.",
  },
  {
    id: "task-master",
    name: "Task Master",
    tagline: "Decompose work into ordered, dependency-aware tasks",
    icon: ListChecks,
    accent: "bg-emerald-700 text-white",
    accentSoft: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    description:
      "Task Master takes a PRD or epic and produces a numbered task list with explicit dependencies, complexity scores, and acceptance criteria. Each task is small enough to fit a single AI session without overflowing the context window. An orchestrator picks the next unblocked task, hands the AI exactly what it needs, and marks it done when verified.",
    solves: [
      "Unbounded scope — the AI knows exactly which task it's on and what done looks like.",
      "Hidden dependencies — work is sequenced so prerequisites land first.",
      "Context exhaustion — each task is self-contained with only the files and notes it needs.",
      "Stalled progress — completed tasks are tracked, blockers are surfaced, and the team always knows the next move.",
    ],
    when: "When a project has more than ~10 stories or any non-linear dependency graph.",
  },
];

const ROT_SYMPTOMS = [
  "Repeats decisions you made 20 messages ago",
  "Reintroduces bugs you already fixed",
  "Forgets file paths, table names, or constraints",
  "Generates code that doesn't match the architecture",
  "Asks for context it was already given",
  "Produces shorter, vaguer answers as the session grows",
];

const ROT_MITIGATIONS = [
  { tool: "BMad", how: "Specialist agents with focused system prompts; durable documents replace ephemeral chat." },
  { tool: "OpenSpec", how: "The spec lives in the repo. Every new session starts fresh from the spec, not from chat scrollback." },
  { tool: "Task Master", how: "Each task is its own scoped session with only the files and acceptance criteria it needs." },
  { tool: "Portfolio Chat", how: "Cross-project state is injected as structured context, not recovered from chat memory." },
];

export default function WhyTools() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
          {/* Header */}
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium uppercase tracking-wider mb-3">
              <Brain size={11} /> Why this stack exists
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-why-title">
              Overcoming the limits of AI-assisted development
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Large language models are powerful, but they have a structural weakness: their context window degrades over the life of a session.
              The tools below — BMad, OpenSpec, and Task Master — each address a different facet of that problem so a team can ship reliable software with AI as a co-worker rather than a liability.
            </p>
          </div>

          {/* Context Rot — The Core Problem */}
          <section className="bg-card border border-border rounded-md overflow-hidden">
            <div className="bg-destructive/5 border-b border-border px-5 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              <h2 className="text-sm font-semibold text-foreground">The Core Problem: Context Rot</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-foreground leading-relaxed">
                <span className="font-semibold">Context rot</span> is the steady degradation of an AI assistant's reasoning quality as a conversation gets longer.
                Even with a 200K-token window, the model's ability to weight, retrieve, and synthesize information across the conversation drops the further back it has to look.
                Recent answers crowd out earlier decisions; instructions buried mid-session get diluted; and the model starts confidently doing the wrong thing.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingDown size={11} /> Symptoms you've seen
                  </div>
                  <ul className="space-y-1.5">
                    {ROT_SYMPTOMS.map((s) => (
                      <li key={s} className="text-xs text-foreground flex items-start gap-2">
                        <XCircle size={11} className="text-destructive mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Target size={11} /> Why it happens
                  </div>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <span>Attention is not uniform across the window — middle-of-context information is recalled less reliably than the very start or end.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <span>Long sessions accumulate noise: false starts, abandoned ideas, intermediate code that contradicts the final design.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <span>The model has no durable memory between sessions, so every restart loses everything that wasn't written down.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded p-3 mt-2">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">The fix is not "a bigger model."</span> The fix is <span className="font-medium">to keep the working set small, structured, and externalized to durable artifacts</span> — exactly what the three tools below were designed to do.
                </p>
              </div>
            </div>
          </section>

          {/* The Three Tools */}
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground" data-testid="text-tools-section-title">
                Three tools, three layers of the fix
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Each tool takes a different cut at context rot. Together they keep the AI focused, accountable, and reproducible across sessions.
              </p>
            </div>

            <div className="space-y-4">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    data-testid={`card-tool-${tool.id}`}
                    className="bg-card border border-border rounded-md overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-border flex items-start gap-4">
                      <div className={`w-10 h-10 rounded ${tool.accent} flex items-center justify-center shrink-0`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-foreground">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{tool.tagline}</p>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <p className="text-sm text-foreground leading-relaxed">{tool.description}</p>

                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                          What it solves
                        </div>
                        <ul className="space-y-1.5">
                          {tool.solves.map((s, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-2">
                              <CheckCircle2 size={11} className="text-primary mt-0.5 shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className={`text-xs px-3 py-2 rounded border ${tool.accentSoft} flex items-start gap-2`}>
                        <Zap size={11} className="mt-0.5 shrink-0" />
                        <span>
                          <span className="font-medium">Reach for it: </span>
                          {tool.when}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* How They Combine */}
          <section className="bg-card border border-border rounded-md overflow-hidden">
            <div className="bg-primary/5 border-b border-border px-5 py-3 flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">How they combine to defeat context rot</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-foreground leading-relaxed">
                None of these tools is sufficient on its own. The compounding value comes from layering them so every conversation has the right amount of context — never too little, never too much.
              </p>

              <div className="overflow-hidden border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-[10px] w-1/4">Tool</th>
                      <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-[10px]">How it fights context rot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ROT_MITIGATIONS.map((m) => (
                      <tr key={m.tool} className="bg-card" data-testid={`row-mitigation-${m.tool.toLowerCase().replace(/\s+/g, "-")}`}>
                        <td className="px-3 py-2.5 font-medium text-foreground align-top">{m.tool}</td>
                        <td className="px-3 py-2.5 text-foreground">{m.how}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid md:grid-cols-3 gap-3 pt-2">
                <FlowStep n="1" label="Specify" body="OpenSpec captures intent as a reviewable artifact before any AI writes code." />
                <FlowStep n="2" label="Plan" body="BMad's Refinement phase turns the spec into INVEST-graded stories with dependencies." />
                <FlowStep n="3" label="Execute" body="Task Master hands the AI one focused task at a time with only the context it needs." />
              </div>
            </div>
          </section>

          {/* Closing call to action */}
          <section className="border border-border bg-card rounded-md p-5 flex items-start gap-4">
            <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Brain size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">The bottom line</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Treat the AI like a strong but forgetful new hire. Give it a tight spec (OpenSpec), a defined process (BMad), and one well-bounded task at a time (Task Master).
                The model's raw capability stops being the limit; your team's discipline does.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function FlowStep({ n, label, body }: { n: string; label: string; body: string }) {
  return (
    <div className="border border-border rounded p-3 bg-card">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
          {n}
        </div>
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <ArrowRight size={10} className="text-muted-foreground/40 ml-auto" />
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
