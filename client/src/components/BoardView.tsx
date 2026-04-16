import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Epic, Story, Sprint } from "@shared/schema";
import {
  ChevronDown, ChevronRight, Plus, Trash2, Edit2, X, Check,
  Target, Zap, AlertTriangle, ArrowUp, ArrowDown, Minus,
  LayoutGrid, List, Import, MessageSquare, Send, Link2, Save, Loader2,
  ShieldCheck, RefreshCw, Wand2, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
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
  const [showFredChat, setShowFredChat] = useState(false);

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

  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const importMutation = useMutation({
    mutationFn: () => apiPost(`/api/projects/${projectId}/import-epics`, {}),
    onSuccess: (data: any) => {
      invalidateAll();
      setImportMessage({ type: "success", text: data.message || `Imported ${data.imported?.epics} epics and ${data.imported?.stories} stories` });
      setTimeout(() => setImportMessage(null), 5000);
    },
    onError: (err: any) => {
      setImportMessage({ type: "error", text: err.message || "Import failed" });
      setTimeout(() => setImportMessage(null), 8000);
    },
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
            data-testid="button-talk-to-fred"
            onClick={() => setShowFredChat(!showFredChat)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
              showFredChat
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted border border-border"
            )}
          >
            <MessageSquare size={14} /> Talk to Fred
          </button>
          <button
            data-testid="button-import-epics"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Import size={14} /> {importMutation.isPending ? "Importing..." : "Import from CE"}
          </button>
          {importMessage && (
            <span className={cn("text-xs px-2 py-1 rounded", importMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
              {importMessage.text}
            </span>
          )}
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

      <div className="flex-1 flex overflow-hidden">
        <div className={cn("flex-1 overflow-auto p-4", showFredChat && "border-r border-border")}>
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

        {showFredChat && (
          <FredChatPanel
            projectId={projectId}
            stories={storiesData}
            onClose={() => setShowFredChat(false)}
            onDependenciesSaved={invalidateAll}
          />
        )}
      </div>

      {editingStory && (
        <StoryDetailModal
          story={editingStory}
          epics={epicsData}
          sprints={sprintsData}
          stories={storiesData}
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
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {epic.description.replace(/\*\*/g, "").replace(/^---+$/gm, "").replace(/\s+/g, " ").trim()}
                  </p>
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

function InvestBadge({ analysis, storyId }: { analysis: { independent: { score: string }; negotiable: { score: string }; valuable: { score: string }; estimable: { score: string }; small: { score: string }; testable: { score: string } }; storyId: number }) {
  const criteria = [analysis.independent, analysis.negotiable, analysis.valuable, analysis.estimable, analysis.small, analysis.testable];
  const passes = criteria.filter(c => c?.score === "pass").length;
  const fails = criteria.filter(c => c?.score === "fail").length;
  const color = fails > 0 ? "text-red-600 bg-red-50 border-red-200" : passes === 6 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-600 bg-amber-50 border-amber-200";
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border", color)} data-testid={`invest-badge-${storyId}`}>
      <ShieldCheck size={9} />
      {passes}/6
    </span>
  );
}

function StoryRow({ story, sprints, onEdit, onInvalidate }: { story: Story; sprints: Sprint[]; onEdit: () => void; onInvalidate: () => void }) {
  const sprint = sprints.find(s => s.id === story.sprintId);
  const hasDeps = story.dependsOn && story.dependsOn.length > 0;

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
      {story.investAnalysis && (
        <InvestBadge analysis={story.investAnalysis as any} storyId={story.id} />
      )}
      {hasDeps && (
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded" data-testid={`deps-badge-${story.id}`}>
          <Link2 size={9} />
          {story.dependsOn!.length}
        </span>
      )}
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
                        {story.investAnalysis && (
                          <InvestBadge analysis={story.investAnalysis as any} storyId={story.id} />
                        )}
                        {story.dependsOn && story.dependsOn.length > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                            <Link2 size={9} />
                            {story.dependsOn.length} dep{story.dependsOn.length > 1 ? "s" : ""}
                          </span>
                        )}
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

const INVEST_LABELS: Record<string, { letter: string; name: string }> = {
  independent: { letter: "I", name: "Independent" },
  negotiable: { letter: "N", name: "Negotiable" },
  valuable: { letter: "V", name: "Valuable" },
  estimable: { letter: "E", name: "Estimable" },
  small: { letter: "S", name: "Small" },
  testable: { letter: "T", name: "Testable" },
};

const INVEST_SCORE_STYLES: Record<string, string> = {
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  fail: "bg-red-50 text-red-700 border-red-200",
};

const INVEST_SCORE_LABELS: Record<string, string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
};

function StoryDetailModal({ story, epics, sprints, stories, onClose, onSave }: {
  story: Story; epics: Epic[]; sprints: Sprint[]; stories: Story[]; onClose: () => void; onSave: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [investLoading, setInvestLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [investData, setInvestData] = useState(story.investAnalysis || null);
  const [storyData, setStoryData] = useState({ title: story.title, description: story.description, acceptanceCriteria: story.acceptanceCriteria });
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
              <p className="px-3 py-2 text-sm font-medium text-foreground">{storyData.title}</p>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{storyData.description || "No description"}</ReactMarkdown>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{storyData.acceptanceCriteria || "No acceptance criteria"}</ReactMarkdown>
              </div>
            )}
          </div>

          {story.dependsOn && story.dependsOn.length > 0 && (
            <div data-testid="story-dependencies-section">
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                <span className="flex items-center gap-1"><Link2 size={11} /> Dependencies</span>
              </label>
              <div className="space-y-1.5">
                {story.dependsOn.map(depId => {
                  const depStory = stories.find(s => s.id === depId);
                  return (
                    <div key={depId} className="flex items-center gap-2 px-3 py-1.5 rounded border border-orange-200 bg-orange-50 text-xs" data-testid={`dep-item-${depId}`}>
                      <Link2 size={10} className="text-orange-500 shrink-0" />
                      <span className="font-mono text-orange-600 shrink-0">#{depId}</span>
                      <span className="text-foreground truncate">{depStory?.title || "Unknown story"}</span>
                      {depStory && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ml-auto", STATUS_COLORS[depStory.status])}>
                          {STATUS_LABELS[depStory.status]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div data-testid="story-invest-section">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1"><ShieldCheck size={11} /> INVEST Analysis</span>
              </label>
              <button
                data-testid="button-run-invest"
                disabled={investLoading}
                onClick={async () => {
                  setInvestLoading(true);
                  try {
                    const res = await fetch(`/api/stories/${story.id}/invest`, { method: "POST", headers: { "Content-Type": "application/json" } });
                    if (!res.ok) throw new Error("Analysis failed");
                    const data = await res.json();
                    setInvestData(data.analysis);
                  } catch (e) {
                    console.error("INVEST error:", e);
                  } finally {
                    setInvestLoading(false);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  investLoading
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-pink-700 text-white hover:bg-pink-800"
                )}
              >
                {investLoading ? (
                  <><Loader2 size={11} className="animate-spin" /> Analyzing...</>
                ) : (
                  <><RefreshCw size={11} /> {investData ? "Re-run INVEST" : "Run INVEST (IN)"}</>
                )}
              </button>
            </div>

            {investData ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(INVEST_LABELS) as string[]).map(key => {
                    const criterion = (investData as any)[key];
                    if (!criterion) return null;
                    const label = INVEST_LABELS[key];
                    const scoreStyle = INVEST_SCORE_STYLES[criterion.score] || INVEST_SCORE_STYLES.warn;
                    return (
                      <div key={key} className={cn("px-2.5 py-2 rounded border text-xs", scoreStyle)} data-testid={`invest-${key}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold">{label.letter} - {label.name}</span>
                          <span className="text-[10px] font-bold uppercase">{INVEST_SCORE_LABELS[criterion.score] || criterion.score}</span>
                        </div>
                        <p className="text-[11px] leading-snug opacity-80">{criterion.notes}</p>
                      </div>
                    );
                  })}
                </div>

                {(investData as any).summary && (
                  <div className="px-3 py-2 rounded border border-border bg-muted/30 text-xs" data-testid="invest-summary">
                    <span className="font-medium text-muted-foreground">Summary: </span>
                    {(investData as any).summary}
                  </div>
                )}

                {(investData as any).suggestions && (investData as any).suggestions.length > 0 ? (
                  <div className="px-3 py-2 rounded border border-blue-100 bg-blue-50/50 text-xs" data-testid="invest-suggestions">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-blue-700">Suggestions:</span>
                      <button
                        data-testid="button-apply-invest"
                        disabled={applyLoading || investLoading}
                        onClick={async () => {
                          setApplyLoading(true);
                          try {
                            const res = await fetch(`/api/stories/${story.id}/invest-apply`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                            });
                            if (!res.ok) throw new Error("Apply failed");
                            const data = await res.json();
                            setInvestData(data.analysis);
                            setStoryData({
                              title: data.story.title,
                              description: data.story.description,
                              acceptanceCriteria: data.story.acceptanceCriteria,
                            });
                            setForm(f => ({
                              ...f,
                              title: data.story.title,
                              description: data.story.description,
                              acceptanceCriteria: data.story.acceptanceCriteria,
                            }));
                            onSave();
                          } catch (e) {
                            console.error("Apply INVEST error:", e);
                          } finally {
                            setApplyLoading(false);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                          applyLoading
                            ? "bg-blue-100 text-blue-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                      >
                        {applyLoading ? (
                          <><Loader2 size={10} className="animate-spin" /> Applying...</>
                        ) : (
                          <><Wand2 size={10} /> Apply Suggestions</>
                        )}
                      </button>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                      {(investData as any).suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : investData ? (
                  <div className="px-3 py-2 rounded border border-emerald-200 bg-emerald-50 text-xs flex items-center gap-2" data-testid="invest-all-pass">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-medium">Story passes all INVEST criteria. No further suggestions needed.</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-3 py-4 rounded border border-dashed border-border bg-muted/20 text-xs text-muted-foreground text-center">
                No INVEST analysis yet. Click "Run INVEST" to evaluate this story.
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

interface FredMessage {
  role: "user" | "assistant";
  content: string;
}

function extractDependencies(content: string): { storyId: number; dependsOn: number[] }[] | null {
  const match = content.match(/```dependencies\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function FredChatPanel({ projectId, stories, onClose, onDependenciesSaved }: {
  projectId: number; stories: Story[]; onClose: () => void; onDependenciesSaved: () => void;
}) {
  const [messages, setMessages] = useState<FredMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [savingDeps, setSavingDeps] = useState(false);
  const [savedDepsForMsg, setSavedDepsForMsg] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: FredMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch(`/api/projects/${projectId}/fred-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "content") {
              fullContent += event.content;
              setStreamingContent(fullContent);
            } else if (event.type === "done") {
              setMessages(prev => [...prev, { role: "assistant", content: event.content }]);
              setStreamingContent("");
            } else if (event.type === "error") {
              setMessages(prev => [...prev, { role: "assistant", content: `Error: ${event.error}` }]);
              setStreamingContent("");
            }
          } catch {}
        }
      }

      if (fullContent && !messages.find(m => m.content === fullContent)) {
        setMessages(prev => {
          if (prev[prev.length - 1]?.role === "assistant" && prev[prev.length - 1]?.content === fullContent) return prev;
          return [...prev, { role: "assistant", content: fullContent }];
        });
        setStreamingContent("");
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveDependencies = async (deps: { storyId: number; dependsOn: number[] }[], msgIndex: number) => {
    setSavingDeps(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/save-dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencies: deps }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(errBody.error || `Save failed (${res.status})`);
      }
      const result = await res.json();
      const failures = result.results?.filter((r: any) => !r.updated) || [];
      if (result.saved > 0) {
        setSavedDepsForMsg(prev => new Set([...prev, msgIndex]));
        onDependenciesSaved();
      }
      const statusMsg = failures.length > 0
        ? `Updated ${result.saved} of ${result.total} stories. ${failures.length} failed: ${failures.map((f: any) => `#${f.storyId} (${f.error})`).join(", ")}`
        : `Dependencies saved successfully. Updated ${result.saved} stories.`;
      setMessages(prev => [...prev, { role: "assistant", content: statusMsg }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Failed to save dependencies: ${err.message}`
      }]);
    } finally {
      setSavingDeps(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-[400px] flex flex-col h-full bg-card shrink-0" data-testid="fred-chat-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">FR</div>
          <div>
            <div className="text-sm font-semibold text-foreground">Fred</div>
            <div className="text-[10px] text-muted-foreground">Senior Scrum Master</div>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-fred-chat">
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
            <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">FR</div>
            <div>
              <p className="text-sm font-medium text-foreground">Sprint Planning with Fred</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Ask Fred to analyze your stories, identify dependencies, and recommend what to include in the next sprint.
              </p>
            </div>
            <div className="space-y-1.5 w-full">
              {[
                "What stories should be in the next sprint?",
                "Analyze dependencies between all stories",
                "Which stories can be worked on in parallel?",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  data-testid={`fred-suggestion-${i}`}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="w-full text-left text-xs px-3 py-2 rounded border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const deps = msg.role === "assistant" ? extractDependencies(msg.content) : null;
          const alreadySaved = savedDepsForMsg.has(i);
          const displayContent = msg.content.replace(/```dependencies[\s\S]*?```/g, "").trim();

          return (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">FR</div>
              )}
              <div className={cn(
                "max-w-[85%] rounded px-3 py-2 text-xs",
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "bg-muted border border-border text-foreground"
              )}>
                <div className="prose prose-xs max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_table]:text-[10px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
                </div>
                {deps && deps.length > 0 && !alreadySaved && (
                  <button
                    data-testid={`button-save-deps-${i}`}
                    onClick={() => handleSaveDependencies(deps, i)}
                    disabled={savingDeps}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-primary text-white text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {savingDeps ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Save Dependencies ({deps.length} stories)
                  </button>
                )}
                {alreadySaved && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <Check size={10} /> Dependencies saved
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isStreaming && streamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">FR</div>
            <div className="max-w-[85%] rounded px-3 py-2 text-xs bg-muted border border-border text-foreground">
              <div className="prose prose-xs max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">FR</div>
            <div className="rounded px-3 py-2 text-xs bg-muted border border-border">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 bg-background">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            data-testid="input-fred-chat"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Fred about sprint planning..."
            className="flex-1 px-3 py-2 rounded border border-border bg-card text-sm text-foreground outline-none resize-none min-h-[36px] max-h-[100px] focus:border-primary/40"
            rows={1}
            disabled={isStreaming}
          />
          <button
            data-testid="button-send-fred"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-2 rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
