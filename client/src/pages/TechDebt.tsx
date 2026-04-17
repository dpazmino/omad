import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import {
  fetchPortfolioTechDebt,
  startTechDebtAssessment,
  type PortfolioTechDebtItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Gauge,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Activity,
  Loader2,
  PlayCircle,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Lock,
  TestTube2,
  FileText,
  Layers,
  Package,
  Server,
  Sparkles,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; agent: string }> = {
  code:          { label: "Code Quality",   icon: Code2,    agent: "Vera"   },
  security:      { label: "Security",       icon: Lock,     agent: "Cyrus"  },
  tests:         { label: "Test Coverage",  icon: TestTube2, agent: "Tara"  },
  documentation: { label: "Documentation",  icon: FileText, agent: "Diana"  },
  architecture:  { label: "Architecture",   icon: Layers,   agent: "Marcus" },
  dependencies:  { label: "Dependencies",   icon: Package,  agent: "Nora"   },
  operations:    { label: "Operations",     icon: Server,   agent: "Otto"   },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high:     "bg-orange-50 text-orange-700 border-orange-200",
  medium:   "bg-amber-50 text-amber-800 border-amber-200",
  low:      "bg-slate-50 text-slate-600 border-slate-200",
};

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "B": return "text-green-700 bg-green-50 border-green-200";
    case "C": return "text-amber-700 bg-amber-50 border-amber-200";
    case "D": return "text-orange-700 bg-orange-50 border-orange-200";
    case "F": return "text-red-700 bg-red-50 border-red-200";
    default:  return "text-muted-foreground bg-muted border-border";
  }
}

function tdrColor(tdr: number): string {
  if (tdr < 5)  return "text-emerald-700";
  if (tdr < 10) return "text-amber-700";
  if (tdr < 20) return "text-orange-700";
  return "text-red-700";
}

function tdrLabel(tdr: number): string {
  if (tdr < 5)  return "Healthy";
  if (tdr < 10) return "Acceptable";
  if (tdr < 20) return "Elevated";
  return "Critical";
}

export default function TechDebt() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const { data: portfolio = [], isLoading } = useQuery({
    queryKey: ["tech-debt-portfolio"],
    queryFn: fetchPortfolioTechDebt,
    refetchInterval: 3000,
  });

  // Auto-select the first project once data loads
  useEffect(() => {
    if (selectedProjectId === null && portfolio.length > 0) {
      setSelectedProjectId(portfolio[0].project.id);
    }
  }, [portfolio, selectedProjectId]);

  const assessMutation = useMutation({
    mutationFn: (projectId: number) => startTechDebtAssessment(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tech-debt-portfolio"] }),
  });

  const aggregate = useMemo(() => computeAggregate(portfolio), [portfolio]);
  const selected = portfolio.find(p => p.project.id === selectedProjectId) || null;

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <header className="px-8 pt-6 pb-4 border-b border-border bg-card">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight" data-testid="text-page-title">
                Technical Debt
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Portfolio-wide technical debt scorecard graded by a panel of seven specialist AI auditors. Quantifies the
                Technical Debt Ratio (TDR), Tech Debt Score (TDS), and a phased Debt Reduction Plan per project.
              </p>
            </div>
            <PortfolioSummary aggregate={aggregate} loading={isLoading} />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <aside className="w-80 border-r border-border bg-card overflow-y-auto" data-testid="panel-projects">
            <div className="px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Projects ({portfolio.length})
              </div>
            </div>
            {portfolio.length === 0 && !isLoading && (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No projects yet. Create a project first.
              </div>
            )}
            <ul className="divide-y divide-border">
              {portfolio.map(({ project, assessment }) => {
                const isActive = project.id === selectedProjectId;
                const isRunning = assessment?.status?.state === "running" || assessment?.status?.state === "pending";
                return (
                  <li key={project.id}>
                    <button
                      onClick={() => setSelectedProjectId(project.id)}
                      data-testid={`button-project-${project.id}`}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors",
                        isActive && "bg-primary/5 border-l-2 border-primary"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">{project.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                          {project.phase} · {project.status}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {assessment ? (
                          <>
                            <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded border", gradeColor(assessment.grade))}>
                              {assessment.grade}
                            </span>
                            <span className={cn("text-[10px]", tdrColor(assessment.tdr))}>
                              TDR {assessment.tdr}%
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Not assessed</span>
                        )}
                        {isRunning && <Loader2 size={11} className="animate-spin text-primary" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <main className="flex-1 overflow-y-auto" data-testid="panel-detail">
            {!selected && (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select a project to view its tech debt assessment.
              </div>
            )}
            {selected && (
              <ProjectDetail
                item={selected}
                onAssess={() => assessMutation.mutate(selected.project.id)}
                isStarting={assessMutation.isPending}
                startError={assessMutation.error as Error | null}
              />
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Portfolio summary card
// ────────────────────────────────────────────────────────────────────────
function PortfolioSummary({ aggregate, loading }: { aggregate: ReturnType<typeof computeAggregate>; loading: boolean }) {
  if (loading) {
    return <div className="text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-2" />Loading…</div>;
  }
  if (aggregate.assessedCount === 0) {
    return (
      <div className="text-right">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Portfolio</div>
        <div className="text-sm text-foreground mt-1">No assessments yet</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Run an audit to populate the scorecard</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-6 text-right" data-testid="summary-portfolio">
      <SummaryStat label="Avg TDS" value={`${aggregate.avgScore}`} sub={`Grade ${aggregate.avgGrade}`} accent={gradeColor(aggregate.avgGrade)} />
      <SummaryStat label="Avg TDR" value={`${aggregate.avgTdr}%`} sub={tdrLabel(aggregate.avgTdr)} accent={tdrColor(aggregate.avgTdr)} />
      <SummaryStat label="Total Remediation" value={`${aggregate.totalDays}d`} sub={`${aggregate.assessedCount}/${aggregate.totalProjects} assessed`} accent="text-foreground" />
    </div>
  );
}

function SummaryStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="min-w-[100px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn("text-2xl font-semibold leading-none mt-1.5", accent)}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function computeAggregate(portfolio: PortfolioTechDebtItem[]) {
  const assessed = portfolio.filter(p => p.assessment && p.assessment.status?.state === "completed");
  if (assessed.length === 0) {
    return { assessedCount: 0, totalProjects: portfolio.length, avgScore: 0, avgGrade: "—", avgTdr: 0, totalDays: 0 };
  }
  const avgScore = Math.round(assessed.reduce((s, p) => s + (p.assessment!.overallScore || 0), 0) / assessed.length);
  const avgTdr = Math.round(assessed.reduce((s, p) => s + (p.assessment!.tdr || 0), 0) / assessed.length);
  const totalDays = assessed.reduce((s, p) => s + (p.assessment!.remediationDays || 0), 0);
  const avgGrade = avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : "F";
  return { assessedCount: assessed.length, totalProjects: portfolio.length, avgScore, avgGrade, avgTdr, totalDays };
}

// ────────────────────────────────────────────────────────────────────────
// Project detail
// ────────────────────────────────────────────────────────────────────────
function ProjectDetail({
  item,
  onAssess,
  isStarting,
  startError,
}: {
  item: PortfolioTechDebtItem;
  onAssess: () => void;
  isStarting: boolean;
  startError: Error | null;
}) {
  const { project, assessment } = item;
  const status = assessment?.status;
  const isRunning = status?.state === "running" || status?.state === "pending";
  const isFailed = status?.state === "failed";
  const isCompleted = status?.state === "completed";

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Project</div>
          <h2 className="text-xl font-semibold text-foreground mt-1" data-testid="text-project-name">{project.name}</h2>
          <div className="text-xs text-muted-foreground mt-1 capitalize">
            Phase: {project.phase} · Status: {project.status}
          </div>
        </div>
        <button
          onClick={onAssess}
          disabled={isRunning || isStarting}
          data-testid="button-run-assessment"
          className={cn(
            "px-4 py-2 rounded text-sm font-medium border transition-colors flex items-center gap-2",
            isRunning || isStarting
              ? "bg-muted text-muted-foreground cursor-not-allowed border-border"
              : "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
          )}
        >
          {isRunning || isStarting ? (
            <><Loader2 size={14} className="animate-spin" /> Running audit…</>
          ) : assessment ? (
            <><PlayCircle size={14} /> Re-run audit</>
          ) : (
            <><PlayCircle size={14} /> Run tech debt audit</>
          )}
        </button>
      </div>

      {startError && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="error-start">
          {startError.message}
        </div>
      )}

      {!assessment && !isStarting && (
        <EmptyState onAssess={onAssess} />
      )}

      {isRunning && status && (
        <RunningPanel status={status} />
      )}

      {isFailed && status && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-semibold mb-1">Assessment failed</div>
          <div>{status.error || "Unknown error"}</div>
        </div>
      )}

      {assessment && (isCompleted || (assessment.overallScore > 0)) && (
        <CompletedAssessment assessment={assessment} />
      )}
    </div>
  );
}

function EmptyState({ onAssess }: { onAssess: () => void }) {
  return (
    <div className="rounded border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <Gauge size={32} className="mx-auto text-muted-foreground mb-3" />
      <div className="text-sm font-medium text-foreground">No assessment on file</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Run the seven-agent audit to grade this project across code quality, security, testing, documentation,
        architecture, dependencies, and operations. Generates TDR, TDS, and a phased Debt Reduction Plan.
      </p>
      <button
        onClick={onAssess}
        data-testid="button-empty-assess"
        className="mt-4 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        Start audit
      </button>
    </div>
  );
}

function RunningPanel({ status }: { status: NonNullable<PortfolioTechDebtItem["assessment"]>["status"] }) {
  const completed = status?.completedAgents ?? [];
  const total = status?.totalAgents ?? 7;
  const pct = Math.round((completed.length / total) * 100);
  const order = ["Vera", "Cyrus", "Tara", "Diana", "Marcus", "Nora", "Otto"];
  return (
    <div className="rounded border border-border bg-card px-5 py-4" data-testid="panel-running">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-foreground flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          Audit in progress · {completed.length}/{total} agents complete
        </div>
        <div className="text-xs text-muted-foreground">{pct}%</div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {order.map(name => {
          const done = completed.includes(name);
          const current = status?.currentAgent === name;
          return (
            <div
              key={name}
              className={cn(
                "rounded border px-2 py-2 text-center",
                done ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : current ? "bg-primary/5 border-primary/30 text-primary"
                : "bg-muted/40 border-border text-muted-foreground"
              )}
            >
              <div className="flex justify-center mb-1">
                {done ? <CheckCircle2 size={14} />
                : current ? <Loader2 size={14} className="animate-spin" />
                : <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-40" />}
              </div>
              <div className="text-[11px] font-medium">{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletedAssessment({ assessment }: { assessment: NonNullable<PortfolioTechDebtItem["assessment"]> }) {
  const { overallScore, tdr, grade, remediationDays, cultureScore, categoryScores, findings, reductionPlan, cultureNotes } = assessment;

  const sortedFindings = [...(findings || [])].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  });

  return (
    <div className="space-y-6" data-testid="panel-completed">
      {/* Headline metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Tech Debt Score"
          value={`${overallScore}`}
          sub={`Grade ${grade}`}
          icon={Gauge}
          accent={gradeColor(grade)}
        />
        <MetricCard
          label="Technical Debt Ratio"
          value={`${tdr}%`}
          sub={`${tdrLabel(tdr)} · target <5%`}
          icon={tdr < 10 ? TrendingDown : TrendingUp}
          accent={cn("border-border bg-card", tdrColor(tdr))}
        />
        <MetricCard
          label="Remediation Effort"
          value={`${remediationDays}d`}
          sub="Total engineer-days"
          icon={Activity}
          accent="border-border bg-card text-foreground"
        />
        <MetricCard
          label="Culture of Excellence"
          value={`${cultureScore}`}
          sub="Craft & discipline indicator"
          icon={ShieldAlert}
          accent="border-border bg-card text-foreground"
        />
      </div>

      {/* Category breakdown */}
      <section className="rounded border border-border bg-card">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Category breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Each domain graded 0–100 by its specialist auditor</p>
        </div>
        <div className="divide-y divide-border">
          {Object.entries(categoryScores).map(([key, score]) => {
            const meta = CATEGORY_META[key];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={key} className="px-5 py-3 flex items-center gap-4" data-testid={`category-${key}`}>
                <Icon size={16} className="text-muted-foreground shrink-0" />
                <div className="w-44 shrink-0">
                  <div className="text-sm font-medium text-foreground">{meta.label}</div>
                  <div className="text-[11px] text-muted-foreground">Audited by {meta.agent}</div>
                </div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      score >= 80 ? "bg-emerald-500" :
                      score >= 60 ? "bg-amber-500" :
                      score >= 40 ? "bg-orange-500" :
                      "bg-red-500"
                    )}
                    style={{ width: `${Math.max(2, score)}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-semibold text-foreground tabular-nums">{score}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reduction plan */}
      {reductionPlan && (
        <section className="rounded border border-border bg-card" data-testid="panel-reduction-plan">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Debt Reduction Plan</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Synthesized by Otto from the panel's findings</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-foreground leading-relaxed">{reductionPlan.summary}</p>
            <div className="grid grid-cols-3 gap-3">
              {reductionPlan.phases?.map((phase, i) => (
                <div key={i} className="rounded border border-border bg-muted/20 p-4" data-testid={`phase-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-primary uppercase tracking-widest">Phase {i + 1}</div>
                    <div className="text-[11px] text-muted-foreground">{phase.durationWeeks}w</div>
                  </div>
                  <div className="text-sm font-medium text-foreground mb-2">{phase.name}</div>
                  <ul className="space-y-1.5 mb-3">
                    {phase.goals?.map((g, j) => (
                      <li key={j} className="text-[12px] text-muted-foreground flex gap-1.5">
                        <ChevronRight size={11} className="mt-1 shrink-0 text-primary" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-[11px] text-emerald-700 font-medium">+{phase.expectedScoreLift} TDS lift</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Culture */}
      {cultureNotes && (
        <section className="rounded border border-border bg-card px-5 py-4" data-testid="panel-culture">
          <h3 className="text-sm font-semibold text-foreground mb-2">Culture of Excellence</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{cultureNotes}</p>
        </section>
      )}

      {/* Findings */}
      <section className="rounded border border-border bg-card">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Findings ({sortedFindings.length})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sorted by severity</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {sortedFindings.length === 0 && (
            <div className="px-5 py-6 text-sm text-muted-foreground text-center">No findings recorded.</div>
          )}
          {sortedFindings.map(f => (
            <div key={f.id} className="px-5 py-4" data-testid={`finding-${f.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border", SEVERITY_STYLES[f.severity])}>
                      {f.severity}
                    </span>
                    <span className="text-[11px] text-muted-foreground capitalize">{f.category}</span>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{f.agent}</span>
                  </div>
                  <div className="text-sm font-medium text-foreground">{f.title}</div>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{f.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Effort</div>
                  <div className="text-sm font-semibold text-foreground tabular-nums">{f.remediationDays}d</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
}) {
  return (
    <div className={cn("rounded border px-5 py-4", accent.includes("bg-") ? accent : "border-border bg-card")}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="opacity-70" />
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{label}</div>
      </div>
      <div className={cn("text-3xl font-semibold leading-none tabular-nums", accent.includes("text-") && !accent.includes("bg-") ? accent : "text-foreground")}>
        {value}
      </div>
      <div className="text-[11px] mt-1.5 opacity-70">{sub}</div>
    </div>
  );
}
