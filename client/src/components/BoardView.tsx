import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Epic, Story, Sprint } from "@shared/schema";
import {
  ChevronDown, ChevronRight, Plus, Trash2, Edit2, X, Check,
  Target, Zap, AlertTriangle, ArrowUp, ArrowDown, Minus,
  LayoutGrid, List, Import
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const STORY_STATUSES = ["backlog", "todo", "in-progress", "review", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 border-slate-200",
  todo: "bg-blue-50 text-blue-700 border-blue-200",
  "in-progress": "bg-amber-50 text-amber-700 border-amber-200",
  review: "bg-purple-50 text-purple-700 border-purple-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={12} className="text-red-500" />,
  high: <ArrowUp size={12} className="text-orange-500" />,
  medium: <Minus size={12} className="text-yellow-500" />,
  low: <ArrowDown size={12} className="text-blue-400" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-blue-50 text-blue-400 border-blue-200",
};

interface BoardViewProps {
  projectId: number;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}

async function apiPost<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

async function apiPatch<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

async function apiDelete(url: string): Promise<void> {
  await fetch(url, { method: "DELETE" });
}

export default function BoardView({ projectId }: BoardViewProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"epics" | "board">("epics");
  const [expandedEpics, setExpandedEpics] = useState<Set<number>>(new Set());
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [showNewEpic, setShowNewEpic] = useState(false);
  const [showNewStory, setShowNewStory] = useState<number | null>(null);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null);

  const { data: epicsData = [] } = useQuery<Epic[]>({
    queryKey: ["epics", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/epics`),
  });

  const { data: storiesData = [] } = useQuery<Story[]>({
    queryKey: ["stories", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/stories`),
  });

  const { data: sprintsData = [] } = useQuery<Sprint[]>({
    queryKey: ["sprints", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/sprints`),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
    queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
    queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
  };

  const importMutation = useMutation({
    mutationFn: () => apiPost(`/api/projects/${projectId}/import-epics`, {}),
    onSuccess: invalidateAll,
  });

  const toggleEpic = (id: number) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const epicStories = (epicId: number) => storiesData.filter(s => s.epicId === epicId);
  const sprintStories = (sprintId: number) => storiesData.filter(s => s.sprintId === sprintId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          <button
            data-testid="button-view-epics"
            onClick={() => setViewMode("epics")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              viewMode === "epics" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <List size={14} /> Epics
          </button>
          <button
            data-testid="button-view-board"
            onClick={() => setViewMode("board")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              viewMode === "board" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <LayoutGrid size={14} /> Board
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-import-epics"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Import size={14} /> {importMutation.isPending ? "Importing..." : "Import from CE"}
          </button>
          <button
            data-testid="button-new-sprint"
            onClick={() => setShowNewSprint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Plus size={14} /> Sprint
          </button>
          <button
            data-testid="button-new-epic"
            onClick={() => setShowNewEpic(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Epic
          </button>
        </div>
      </div>

      {showNewSprint && (
        <NewSprintForm
          projectId={projectId}
          onClose={() => setShowNewSprint(false)}
          onCreated={invalidateAll}
        />
      )}

      {showNewEpic && (
        <NewEpicForm
          projectId={projectId}
          onClose={() => setShowNewEpic(false)}
          onCreated={invalidateAll}
        />
      )}

      <div className="flex-1 overflow-auto p-4">
        {epicsData.length === 0 && storiesData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <Target size={48} className="text-muted-foreground/30" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">No epics yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Run the <span className="font-mono bg-muted px-1.5 py-0.5 rounded">CE</span> command to generate epics and stories from your PRD, then click "Import from CE" to load them here.
              </p>
            </div>
          </div>
        ) : viewMode === "epics" ? (
          <EpicListView
            epics={epicsData}
            stories={storiesData}
            sprints={sprintsData}
            expandedEpics={expandedEpics}
            onToggleEpic={toggleEpic}
            epicStories={epicStories}
            onEditStory={setEditingStory}
            showNewStory={showNewStory}
            onShowNewStory={setShowNewStory}
            projectId={projectId}
            onInvalidate={invalidateAll}
          />
        ) : (
          <KanbanBoard
            stories={storiesData}
            epics={epicsData}
            sprints={sprintsData}
            selectedSprint={selectedSprint}
            onSelectSprint={setSelectedSprint}
            onEditStory={setEditingStory}
            projectId={projectId}
            onInvalidate={invalidateAll}
          />
        )}
      </div>

      {editingStory && (
        <StoryDetailModal
          story={editingStory}
          epics={epicsData}
          sprints={sprintsData}
          onClose={() => setEditingStory(null)}
          onSave={invalidateAll}
        />
      )}
    </div>
  );
}

function EpicListView({ epics, stories, sprints, expandedEpics, onToggleEpic, epicStories, onEditStory, showNewStory, onShowNewStory, projectId, onInvalidate }: {
  epics: Epic[]; stories: Story[]; sprints: Sprint[]; expandedEpics: Set<number>;
  onToggleEpic: (id: number) => void; epicStories: (id: number) => Story[];
  onEditStory: (s: Story) => void; showNewStory: number | null;
  onShowNewStory: (id: number | null) => void; projectId: number; onInvalidate: () => void;
}) {
  return (
    <div className="space-y-3">
      {epics.map(epic => {
        const es = epicStories(epic.id);
        const doneCount = es.filter(s => s.status === "done").length;
        const totalPoints = es.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
        const isExpanded = expandedEpics.has(epic.id);

        return (
          <div key={epic.id} className="glass-card rounded-md overflow-hidden" data-testid={`epic-card-${epic.id}`}>
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => onToggleEpic(epic.id)}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">{epic.title}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[epic.status])}>
                    {STATUS_LABELS[epic.status] || epic.status}
                  </span>
                </div>
                {epic.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{epic.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span>{doneCount}/{es.length} stories</span>
                {totalPoints > 0 && <span>{totalPoints} pts</span>}
                <EpicActions epicId={epic.id} onInvalidate={onInvalidate} />
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border">
                {es.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground italic">No stories yet</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {es.map(story => (
                      <StoryRow key={story.id} story={story} sprints={sprints} onEdit={() => onEditStory(story)} onInvalidate={onInvalidate} />
                    ))}
                  </div>
                )}
                {showNewStory === epic.id ? (
                  <NewStoryForm
                    epicId={epic.id}
                    projectId={projectId}
                    onClose={() => onShowNewStory(null)}
                    onCreated={onInvalidate}
                  />
                ) : (
                  <button
                    data-testid={`button-add-story-${epic.id}`}
                    onClick={(e) => { e.stopPropagation(); onShowNewStory(epic.id); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 w-full transition-colors"
                  >
                    <Plus size={12} /> Add Story
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StoryRow({ story, sprints, onEdit, onInvalidate }: { story: Story; sprints: Sprint[]; onEdit: () => void; onInvalidate: () => void }) {
  const sprint = sprints.find(s => s.id === story.sprintId);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 cursor-pointer transition-colors group"
      onClick={onEdit}
      data-testid={`story-row-${story.id}`}
    >
      <div className="flex items-center gap-1.5">
        {PRIORITY_ICONS[story.priority]}
      </div>
      <span className="flex-1 text-sm text-foreground truncate">{story.title}</span>
      {story.storyPoints && (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{story.storyPoints}</span>
      )}
      {sprint && (
        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{sprint.name}</span>
      )}
      <span className={cn("text-xs px-2 py-0.5 rounded-full border shrink-0", STATUS_COLORS[story.status])}>
        {STATUS_LABELS[story.status] || story.status}
      </span>
      <button
        data-testid={`button-delete-story-${story.id}`}
        onClick={(e) => { e.stopPropagation(); apiDelete(`/api/stories/${story.id}`).then(onInvalidate); }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function KanbanBoard({ stories, epics, sprints, selectedSprint, onSelectSprint, onEditStory, projectId, onInvalidate }: {
  stories: Story[]; epics: Epic[]; sprints: Sprint[]; selectedSprint: number | null;
  onSelectSprint: (id: number | null) => void; onEditStory: (s: Story) => void;
  projectId: number; onInvalidate: () => void;
}) {
  const [draggedStoryId, setDraggedStoryId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const filtered = selectedSprint !== null
    ? stories.filter(s => s.sprintId === selectedSprint)
    : stories;

  const handleDragStart = (e: React.DragEvent, storyId: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(storyId));
    setDraggedStoryId(storyId);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    setDraggedStoryId(null);
    const storyId = parseInt(e.dataTransfer.getData("text/plain"));
    const story = stories.find(s => s.id === storyId);
    if (!story || story.status === newStatus) return;
    await apiPatch(`/api/stories/${storyId}`, { status: newStatus });
    onInvalidate();
  };

  const handleDragEnd = () => {
    setDraggedStoryId(null);
    setDragOverStatus(null);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>
        <button
          data-testid="filter-all-sprints"
          onClick={() => onSelectSprint(null)}
          className={cn("text-xs px-2.5 py-1 rounded-lg transition-colors",
            selectedSprint === null ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All
        </button>
        <button
          data-testid="filter-no-sprint"
          onClick={() => onSelectSprint(0)}
          className={cn("text-xs px-2.5 py-1 rounded-lg transition-colors",
            selectedSprint === 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Unassigned
        </button>
        {sprints.map(sp => (
          <button
            key={sp.id}
            data-testid={`filter-sprint-${sp.id}`}
            onClick={() => onSelectSprint(sp.id)}
            className={cn("text-xs px-2.5 py-1 rounded-lg transition-colors",
              selectedSprint === sp.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {sp.name}
          </button>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-5 gap-3 min-h-0 overflow-x-auto">
        {STORY_STATUSES.map(status => {
          const columnStories = selectedSprint === 0
            ? filtered.filter(s => s.status === status && !s.sprintId)
            : filtered.filter(s => s.status === status);

          return (
            <div
              key={status}
              className="flex flex-col min-w-[200px]"
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0",
                STATUS_COLORS[status]
              )}>
                <span className="text-xs font-semibold">{STATUS_LABELS[status]}</span>
                <span className="text-xs opacity-70">{columnStories.length}</span>
              </div>
              <div className={cn(
                "flex-1 border border-border rounded-b-lg p-2 space-y-2 overflow-auto transition-colors",
                dragOverStatus === status ? "bg-primary/5 border-primary/30" : "bg-muted/20"
              )}>
                {columnStories.map(story => {
                  const epic = epics.find(e => e.id === story.epicId);
                  return (
                    <div
                      key={story.id}
                      data-testid={`kanban-card-${story.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, story.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onEditStory(story)}
                      className={cn(
                        "glass-card rounded-lg p-3 cursor-grab hover:shadow-md transition-all group",
                        draggedStoryId === story.id && "opacity-40 scale-95"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-medium text-foreground leading-tight">{story.title}</span>
                        {PRIORITY_ICONS[story.priority]}
                      </div>
                      {epic && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{epic.title}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {story.storyPoints && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{story.storyPoints}</span>
                        )}
                        {story.assignee && (
                          <span className="text-xs text-muted-foreground">{story.assignee}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryDetailModal({ story, epics, sprints, onClose, onSave }: {
  story: Story; epics: Epic[]; sprints: Sprint[]; onClose: () => void; onSave: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    title: story.title,
    description: story.description,
    acceptanceCriteria: story.acceptanceCriteria,
    status: story.status,
    priority: story.priority,
    storyPoints: story.storyPoints || "",
    sprintId: story.sprintId || "",
    assignee: story.assignee || "",
  });

  const handleSave = async () => {
    await apiPatch(`/api/stories/${story.id}`, {
      ...form,
      storyPoints: form.storyPoints ? Number(form.storyPoints) : null,
      sprintId: form.sprintId ? Number(form.sprintId) : null,
      assignee: form.assignee || null,
    });
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-md shadow-lg border border-border w-full max-w-2xl max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{isEditing ? "Edit Story" : "Story Details"}</h3>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-toggle-edit-story"
              onClick={() => setIsEditing(!isEditing)}
              className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors", isEditing ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}
            >
              {isEditing ? "View" : "Edit"}
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-story-modal">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Title</label>
            {isEditing ? (
              <input
                data-testid="input-story-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40"
              />
            ) : (
              <p className="px-3 py-2 text-sm font-medium text-foreground">{form.title}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              {isEditing ? (
                <select
                  data-testid="select-story-status"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
                >
                  {STORY_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              ) : (
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[form.status])}>
                  {STATUS_LABELS[form.status] || form.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Priority:</span>
              {isEditing ? (
                <select
                  data-testid="select-story-priority"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              ) : (
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", PRIORITY_COLORS[form.priority])}>
                  {form.priority.charAt(0).toUpperCase() + form.priority.slice(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Points:</span>
              {isEditing ? (
                <input
                  data-testid="input-story-points"
                  type="number"
                  value={form.storyPoints}
                  onChange={e => setForm(f => ({ ...f, storyPoints: e.target.value }))}
                  className="w-16 px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
                  placeholder="—"
                />
              ) : (
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{form.storyPoints || "—"}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Sprint:</span>
              {isEditing ? (
                <select
                  data-testid="select-story-sprint"
                  value={form.sprintId}
                  onChange={e => setForm(f => ({ ...f, sprintId: e.target.value }))}
                  className="px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
                >
                  <option value="">No Sprint</option>
                  {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <span className="text-xs bg-muted/50 px-2 py-0.5 rounded">
                  {sprints.find(s => s.id === Number(form.sprintId))?.name || "None"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Assignee:</span>
              {isEditing ? (
                <input
                  data-testid="input-story-assignee"
                  value={form.assignee}
                  onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
                  className="w-28 px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none"
                  placeholder="Unassigned"
                />
              ) : (
                <span className="text-xs text-foreground">{form.assignee || "Unassigned"}</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
            {isEditing ? (
              <textarea
                data-testid="input-story-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none resize-none min-h-[80px]"
                rows={3}
              />
            ) : (
              <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm prose prose-sm max-w-none">
                <ReactMarkdown>{form.description || "No description"}</ReactMarkdown>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Acceptance Criteria</label>
            {isEditing ? (
              <textarea
                data-testid="input-story-ac"
                value={form.acceptanceCriteria}
                onChange={e => setForm(f => ({ ...f, acceptanceCriteria: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none resize-none min-h-[80px]"
                rows={3}
              />
            ) : (
              <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm prose prose-sm max-w-none">
                <ReactMarkdown>{form.acceptanceCriteria || "No acceptance criteria"}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            data-testid="button-cancel-story"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            {isEditing ? "Cancel" : "Close"}
          </button>
          {isEditing && (
            <button
              data-testid="button-save-story"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EpicActions({ epicId, onInvalidate }: { epicId: number; onInvalidate: () => void }) {
  return (
    <button
      data-testid={`button-delete-epic-${epicId}`}
      onClick={(e) => { e.stopPropagation(); apiDelete(`/api/epics/${epicId}`).then(onInvalidate); }}
      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
    >
      <Trash2 size={14} />
    </button>
  );
}

function NewEpicForm({ projectId, onClose, onCreated }: { projectId: number; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await apiPost(`/api/projects/${projectId}/epics`, { title, description });
    onCreated();
    onClose();
  };

  return (
    <div className="px-4 py-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <input
          data-testid="input-new-epic-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Epic title..."
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40"
          autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90" data-testid="button-confirm-new-epic">
          <Check size={14} />
        </button>
        <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" data-testid="button-cancel-new-epic">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function NewStoryForm({ epicId, projectId, onClose, onCreated }: { epicId: number; projectId: number; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await apiPost(`/api/projects/${projectId}/stories`, { title, epicId });
    onCreated();
    onClose();
  };

  return (
    <div className="px-4 py-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <input
          data-testid="input-new-story-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Story title..."
          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40"
          autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90" data-testid="button-confirm-new-story">
          <Check size={12} />
        </button>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" data-testid="button-cancel-new-story">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function NewSprintForm({ projectId, onClose, onCreated }: { projectId: number; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await apiPost(`/api/projects/${projectId}/sprints`, { name, goal });
    onCreated();
    onClose();
  };

  return (
    <div className="px-4 py-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <input
          data-testid="input-new-sprint-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Sprint name (e.g., Sprint 1)..."
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40"
          autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
        <input
          data-testid="input-new-sprint-goal"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="Sprint goal (optional)..."
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground outline-none"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90" data-testid="button-confirm-new-sprint">
          <Check size={14} />
        </button>
        <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" data-testid="button-cancel-new-sprint">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
