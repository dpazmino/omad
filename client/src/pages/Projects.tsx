import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Plus, FolderKanban, Clock, Trash2, MoreVertical, Github, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchProjects, createProject, deleteProject, updateProject, importGithubProject, GithubImportError, fetchImportStatus } from "@/lib/api";
import type { Project } from "@shared/schema";

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  analysis: { label: "Analysis", color: "bg-blue-600" },
  planning: { label: "Planning", color: "bg-violet-600" },
  solutioning: { label: "Solutioning", color: "bg-amber-600" },
  implementation: { label: "Implementation", color: "bg-emerald-600" },
  completed: { label: "Completed", color: "bg-green-600" },
};

const STATUS_LABELS: Record<string, { label: string; dotColor: string }> = {
  active: { label: "Active", dotColor: "bg-green-500" },
  paused: { label: "Paused", dotColor: "bg-yellow-500" },
  completed: { label: "Completed", dotColor: "bg-green-600" },
  archived: { label: "Archived", dotColor: "bg-gray-400" },
};

export default function Projects() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [intent, setIntent] = useState("");
  const [importError, setImportError] = useState<{ message: string; partialProjectId?: number } | null>(null);
  const [activeImportProjectId, setActiveImportProjectId] = useState<number | null>(null);
  const [, navigate] = useLocation();

  const { data: importStatus } = useQuery({
    queryKey: ["import-status", activeImportProjectId],
    queryFn: () => fetchImportStatus(activeImportProjectId!),
    enabled: activeImportProjectId !== null,
    refetchInterval: (q) => {
      const s = q.state.data?.importStatus?.state;
      return s === "completed" || s === "failed" ? false : 2000;
    },
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
    },
  });

  const importMutation = useMutation({
    mutationFn: ({ url, userIntent }: { url: string; userIntent: string }) => importGithubProject(url, userIntent),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setActiveImportProjectId(data.projectId);
      setImportError(null);
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (err instanceof GithubImportError && err.partial && err.projectId) {
        setImportError({ message: err.message, partialProjectId: err.projectId });
      } else {
        setImportError({ message: err.message || "Import failed" });
      }
    },
  });

  const closeImportModal = () => {
    setShowImport(false);
    setRepoUrl("");
    setIntent("");
    setImportError(null);
    setActiveImportProjectId(null);
    importMutation.reset();
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (!repoUrl.trim()) return;
    importMutation.mutate({ url: repoUrl.trim(), userIntent: intent.trim() });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), description: newDescription.trim() });
  };

  const activeProjects = projects.filter(p => p.status === "active");
  const otherProjects = projects.filter(p => p.status !== "active");

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-projects-title">Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage development projects.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                data-testid="button-import-github"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 bg-card hover:bg-muted text-foreground px-4 py-2 rounded text-sm font-medium border border-border transition-colors"
              >
                <Github size={14} />
                Import from GitHub
              </button>
              <button
                data-testid="button-create-project"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                New Project
              </button>
            </div>
          </div>

          {showImport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-6">
              <div className="bg-card w-full max-w-lg p-6 rounded-md border border-border shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Github size={16} className="text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Import from GitHub</h2>
                </div>

                {activeImportProjectId === null ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-4">
                      We'll fetch the repo, then generate the full BMad document set (Brief, PRD, UX, Architecture, Epics &amp; Stories) grounded in the real code. Generation runs in the background — you can close this window and come back.
                    </p>
                    <form onSubmit={handleImport} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1">Repository URL</label>
                        <input
                          data-testid="input-repo-url"
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/owner/repo"
                          disabled={importMutation.isPending}
                          className="w-full px-3 py-2 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm font-mono disabled:opacity-60"
                          autoFocus
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Public repositories only. Accepts `owner/repo` or full URL.</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground block mb-1">What do you want to change? (optional)</label>
                        <textarea
                          data-testid="input-import-intent"
                          value={intent}
                          onChange={(e) => setIntent(e.target.value)}
                          placeholder="e.g. Add multi-tenant support, migrate from REST to GraphQL, introduce audit logging across all services..."
                          disabled={importMutation.isPending}
                          className="w-full px-3 py-2 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm min-h-[96px] resize-none disabled:opacity-60"
                          rows={4}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Describing your intent produces sharper epics and story-level file changes.</p>
                      </div>

                      {importError && (
                        <div className="text-xs bg-destructive/10 border border-destructive/20 rounded px-3 py-2 space-y-2" data-testid="text-import-error">
                          <div className="text-destructive">{importError.message}</div>
                          {importError.partialProjectId && (
                            <button
                              type="button"
                              data-testid="button-open-partial-project"
                              onClick={() => navigate(`/projects/${importError.partialProjectId}`)}
                              className="text-primary hover:underline text-xs font-medium"
                            >
                              Open partial project →
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          data-testid="button-cancel-import"
                          onClick={closeImportModal}
                          disabled={importMutation.isPending}
                          className="px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          data-testid="button-confirm-import"
                          disabled={!repoUrl.trim() || importMutation.isPending}
                          className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {importMutation.isPending ? (
                            <><Loader2 size={12} className="animate-spin" /> Starting…</>
                          ) : (
                            <><CheckCircle2 size={12} /> Import &amp; Generate</>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <ImportProgressView
                    status={importStatus}
                    projectId={activeImportProjectId}
                    onClose={closeImportModal}
                    onOpenProject={() => { const id = activeImportProjectId; closeImportModal(); navigate(`/projects/${id}`); }}
                  />
                )}
              </div>
            </div>
          )}

          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm">
              <div className="bg-card w-full max-w-md p-6 rounded-md border border-border shadow-lg">
                <h2 className="text-base font-semibold mb-4 text-foreground">New Project</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Project Name</label>
                    <input
                      data-testid="input-project-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter project name"
                      className="w-full px-3 py-2 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Description (optional)</label>
                    <textarea
                      data-testid="input-project-description"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Brief project description"
                      className="w-full px-3 py-2 rounded bg-background border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm min-h-[72px] resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      data-testid="button-cancel-create"
                      onClick={() => { setShowCreate(false); setNewName(""); setNewDescription(""); }}
                      className="px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="button-confirm-create"
                      disabled={!newName.trim() || createMutation.isPending}
                      className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {createMutation.isPending ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card h-24 rounded-md border border-border animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center mb-3">
                <FolderKanban size={24} className="text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-1 text-foreground">No projects yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Create your first project to begin.
              </p>
              <button
                data-testid="button-create-first-project"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                New Project
              </button>
            </div>
          ) : (
            <>
              {activeProjects.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active ({activeProjects.length})</h2>
                  {activeProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onDelete={() => deleteMutation.mutate(project.id)} />
                  ))}
                </div>
              )}

              {otherProjects.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Other ({otherProjects.length})</h2>
                  {otherProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onDelete={() => deleteMutation.mutate(project.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ImportProgressView({
  status,
  projectId,
  onClose,
  onOpenProject,
}: {
  status: { importStatus: { state: string; currentStep?: string; completedSteps: string[]; totalSteps: number; error?: string; source?: string } | null; documentsCreated: { id: number; title: string; docType: string }[] } | undefined;
  projectId: number;
  onClose: () => void;
  onOpenProject: () => void;
}) {
  const STEPS = ["Product Brief", "Product Requirements Document", "UX Design", "Architecture Document", "Epics & Stories"];
  const s = status?.importStatus;
  const completed = new Set(s?.completedSteps ?? []);
  const current = s?.currentStep;
  const state = s?.state ?? "pending";
  const isDone = state === "completed";
  const isFailed = state === "failed";
  const completedCount = completed.size;
  const totalSteps = s?.totalSteps ?? STEPS.length;
  const pct = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="space-y-4" data-testid="import-progress-view">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{s?.source ?? `project ${projectId}`}</span>
        <span>·</span>
        <span data-testid="text-import-state">
          {isDone ? "Completed" : isFailed ? "Failed" : `Generating ${completedCount + (current && !isDone ? 1 : 0)} of ${totalSteps}`}
        </span>
      </div>

      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500", isFailed ? "bg-destructive" : "bg-primary")}
          style={{ width: `${isDone ? 100 : pct}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {STEPS.map((step) => {
          const done = completed.has(step);
          const active = current === step && !done && !isDone;
          return (
            <li
              key={step}
              data-testid={`row-import-step-${step.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex items-center gap-2 text-xs px-2.5 py-2 rounded border transition-colors",
                done && "bg-primary/5 border-primary/20 text-foreground",
                active && "bg-muted/40 border-border text-foreground",
                !done && !active && "bg-card border-border text-muted-foreground",
              )}
            >
              {done ? (
                <CheckCircle2 size={13} className="text-primary shrink-0" />
              ) : active ? (
                <Loader2 size={13} className="animate-spin text-primary shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-border shrink-0" />
              )}
              <span className="flex-1">{step}</span>
              {done && <span className="text-[10px] text-primary font-medium">Done</span>}
              {active && <span className="text-[10px] text-primary font-medium">Generating…</span>}
            </li>
          );
        })}
      </ul>

      {isFailed && (
        <div className="text-xs bg-destructive/10 border border-destructive/20 rounded px-3 py-2 flex items-start gap-2" data-testid="text-import-failure">
          <AlertTriangle size={12} className="text-destructive mt-0.5 shrink-0" />
          <div>
            <div className="font-medium text-destructive">Import failed after {completedCount} of {totalSteps} documents</div>
            <div className="text-muted-foreground mt-0.5 break-words">{s?.error || "Unknown error"}</div>
            {completedCount > 0 && (
              <div className="text-muted-foreground mt-1">The partial project was kept. Open it to review what was generated, then re-run failed steps with the agents.</div>
            )}
          </div>
        </div>
      )}

      {!isDone && !isFailed && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 border border-border rounded px-3 py-2">
          You can close this window — generation continues in the background. Open the project anytime to see live progress.
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          data-testid="button-close-import-progress"
          onClick={onClose}
          className="px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Close
        </button>
        <button
          type="button"
          data-testid="button-open-imported-project"
          onClick={onOpenProject}
          className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isDone ? "Open project" : "Open project anyway"}
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [, navigate] = useLocation();
  const phase = PHASE_LABELS[project.phase] || PHASE_LABELS.analysis;
  const status = STATUS_LABELS[project.status] || STATUS_LABELS.active;

  return (
    <div
      data-testid={`card-project-${project.id}`}
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-card p-4 rounded-md border border-border relative group transition-colors hover:border-primary/15 cursor-pointer"
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5 rounded-l", phase.color)} />

      <div className="flex items-start justify-between gap-4 pl-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate" data-testid={`text-project-name-${project.id}`}>
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium text-white", phase.color)}>
              {phase.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <div className={cn("w-1.5 h-1.5 rounded-full", status.dotColor)} />
              {status.label}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock size={10} />
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            data-testid={`button-project-menu-${project.id}`}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <MoreVertical size={14} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-card rounded border border-border shadow-md z-50 py-1">
                <button
                  data-testid={`button-delete-project-${project.id}`}
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-muted flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
