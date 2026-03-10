import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Plus, FolderKanban, Clock, ArrowRight, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchProjects, createProject, deleteProject, updateProject } from "@/lib/api";
import type { Project } from "@shared/schema";

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  analysis: { label: "Analysis", color: "bg-blue-500" },
  planning: { label: "Planning", color: "bg-purple-500" },
  solutioning: { label: "Solutioning", color: "bg-amber-500" },
  implementation: { label: "Implementation", color: "bg-green-500" },
  completed: { label: "Completed", color: "bg-emerald-500" },
};

const STATUS_LABELS: Record<string, { label: string; dotColor: string }> = {
  active: { label: "In Progress", dotColor: "bg-green-500" },
  paused: { label: "Paused", dotColor: "bg-yellow-500" },
  completed: { label: "Completed", dotColor: "bg-emerald-500" },
  archived: { label: "Archived", dotColor: "bg-gray-500" },
};

export default function Projects() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

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
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading font-bold mb-2 text-foreground" data-testid="text-projects-title">Projects</h1>
              <p className="text-muted-foreground">Manage your BMad development projects.</p>
            </div>
            <button
              data-testid="button-create-project"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md p-6 rounded-2xl border border-border shadow-xl animate-in zoom-in-95 duration-200">
                <h2 className="text-xl font-heading font-bold mb-4 text-foreground">New Project</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Project Name</label>
                    <input
                      data-testid="input-project-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="My Awesome App"
                      className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Description (optional)</label>
                    <textarea
                      data-testid="input-project-description"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Brief description of what you're building..."
                      className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all text-sm min-h-[80px] resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      data-testid="button-cancel-create"
                      onClick={() => { setShowCreate(false); setNewName(""); setNewDescription(""); }}
                      className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="button-confirm-create"
                      disabled={!newName.trim() || createMutation.isPending}
                      className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Project"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white h-32 rounded-xl border border-border animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/10 flex items-center justify-center mb-4">
                <FolderKanban size={32} className="text-primary" />
              </div>
              <h2 className="text-xl font-heading font-semibold mb-2 text-foreground">No projects yet</h2>
              <p className="text-muted-foreground max-w-sm mb-6">
                Create your first project to start using the BMad Method with your AI development team.
              </p>
              <button
                data-testid="button-create-first-project"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Create Your First Project
              </button>
            </div>
          ) : (
            <>
              {activeProjects.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">In Progress ({activeProjects.length})</h2>
                  {activeProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onDelete={() => deleteMutation.mutate(project.id)} />
                  ))}
                </div>
              )}

              {otherProjects.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Other ({otherProjects.length})</h2>
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

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [, navigate] = useLocation();
  const phase = PHASE_LABELS[project.phase] || PHASE_LABELS.analysis;
  const status = STATUS_LABELS[project.status] || STATUS_LABELS.active;

  return (
    <div
      data-testid={`card-project-${project.id}`}
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-white p-5 rounded-xl border border-border relative overflow-hidden group transition-all duration-200 hover:border-primary/20 hover:shadow-md cursor-pointer"
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", phase.color)} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/8 border border-primary/10">
              <FolderKanban size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-heading font-semibold truncate text-foreground" data-testid={`text-project-name-${project.id}`}>
                {project.name}
              </h3>
              {project.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-12 mt-3 flex-wrap">
            <span className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", 
              `${phase.color}/10 text-foreground border-border`
            )}>
              Phase: {phase.label}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn("w-2 h-2 rounded-full", status.dotColor)} />
              {status.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} />
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            data-testid={`button-project-menu-${project.id}`}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg border border-border shadow-lg z-50 py-1">
                <button
                  data-testid={`button-delete-project-${project.id}`}
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-muted flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Project
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
