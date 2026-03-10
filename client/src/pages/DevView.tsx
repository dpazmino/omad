import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import type { Story, Epic, Sprint } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Copy, Check, AlertTriangle, ArrowUp, ArrowDown, Minus,
  ChevronDown, ChevronRight, Merge, ClipboardList, Sparkles, X,
  CheckCircle2, FileText, Loader2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={14} className="text-red-500" />,
  high: <ArrowUp size={14} className="text-orange-500" />,
  medium: <Minus size={14} className="text-yellow-500" />,
  low: <ArrowDown size={14} className="text-blue-400" />,
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600",
  todo: "bg-blue-50 text-blue-700",
  "in-progress": "bg-amber-50 text-amber-700",
  review: "bg-purple-50 text-purple-700",
  done: "bg-emerald-50 text-emerald-700",
};

export default function DevView() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id!);
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [aggregatedPrompt, setAggregatedPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<number>>(new Set());

  const { data: stories = [] } = useQuery<Story[]>({
    queryKey: ["stories", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/stories`),
  });
  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ["epics", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/epics`),
  });
  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ["sprints", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/sprints`),
  });
  const { data: duplicates } = useQuery<{ groups: { primary: number; duplicates: number[]; reason: string }[]; stories: Story[] }>({
    queryKey: ["duplicates", projectId],
    queryFn: () => apiGet(`/api/projects/${projectId}/duplicate-stories`),
    enabled: showDuplicates,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["stories", projectId] });
    queryClient.invalidateQueries({ queryKey: ["duplicates", projectId] });
  };

  const inProgressStories = stories.filter(s => s.status === "in-progress" && !s.mergedIntoStoryId);
  const storiesWithPrompts = inProgressStories.filter(s => s.prompt);

  const aggregateMutation = useMutation({
    mutationFn: () => {
      const ids = selectedStoryIds.size > 0 ? Array.from(selectedStoryIds) : undefined;
      return apiPost<{ prompt: string }>(`/api/projects/${projectId}/aggregate-prompts`, { storyIds: ids });
    },
    onSuccess: (data) => {
      setAggregatedPrompt(data.prompt);
      toast({ title: "Prompts aggregated", description: `Combined prompts ready to copy` });
    },
    onError: (e: Error) => toast({ title: "Aggregation failed", description: e.message, variant: "destructive" }),
  });

  const mergeMutation = useMutation({
    mutationFn: (args: { primaryId: number; duplicateIds: number[] }) =>
      apiPost(`/api/stories/merge`, args),
    onSuccess: () => {
      invalidateAll();
      setShowDuplicates(true);
      queryClient.invalidateQueries({ queryKey: ["duplicates", projectId] });
      toast({ title: "Stories merged successfully" });
    },
    onError: (e: Error) => toast({ title: "Merge failed", description: e.message, variant: "destructive" }),
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleStorySelection = (id: number) => {
    setSelectedStoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectStory = (story: Story) => {
    setSelectedStory(story);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <Link href={`/projects/${projectId}`} data-testid="link-back-to-project" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-heading font-semibold text-foreground" data-testid="text-dev-view-title">Dev View</h1>
            <p className="text-xs text-muted-foreground">
              {inProgressStories.length} in-progress stories &middot; {storiesWithPrompts.length} with prompts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-show-duplicates"
              onClick={() => setShowDuplicates(!showDuplicates)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                showDuplicates ? "bg-amber-100 text-amber-800" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Merge size={14} /> Duplicates
              {duplicates && duplicates.groups.length > 0 && (
                <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{duplicates.groups.length}</span>
              )}
            </button>
            <button
              data-testid="button-aggregate-prompts"
              onClick={() => aggregateMutation.mutate()}
              disabled={aggregateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <Sparkles size={14} /> {aggregateMutation.isPending ? "Building..." : "Aggregate Prompts"}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[380px] border-r border-border flex flex-col overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress Stories</span>
            </div>
            <div className="flex-1 overflow-auto">
              {inProgressStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <ClipboardList size={40} className="text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No stories in progress</p>
                  <p className="text-xs text-muted-foreground mt-1">Move stories to "In Progress" on the Board tab</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {inProgressStories.map(story => {
                    const epic = epics.find(e => e.id === story.epicId);
                    const isSelected = selectedStory?.id === story.id;
                    const isChecked = selectedStoryIds.has(story.id);

                    return (
                      <div
                        key={story.id}
                        data-testid={`dev-story-${story.id}`}
                        className={cn("flex items-start gap-2 px-3 py-3 cursor-pointer transition-colors",
                          isSelected ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/30 border-l-2 border-transparent"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStorySelection(story.id)}
                          className="mt-1 shrink-0 accent-primary"
                          data-testid={`checkbox-story-${story.id}`}
                        />
                        <div className="flex-1 min-w-0" onClick={() => selectStory(story)}>
                          <div className="flex items-center gap-1.5">
                            {PRIORITY_ICONS[story.priority]}
                            <span className="text-sm font-medium text-foreground truncate">{story.title}</span>
                          </div>
                          {epic && <p className="text-xs text-muted-foreground mt-0.5 truncate">{epic.title}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {story.storyPoints && <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{story.storyPoints}</span>}
                            {story.prompt ? (
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <CheckCircle2 size={10} /> Prompt ready
                              </span>
                            ) : (
                              <span className="text-xs bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">No prompt</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {showDuplicates && duplicates ? (
              <DuplicatePanel
                groups={duplicates.groups}
                stories={stories}
                epics={epics}
                onMerge={(primaryId, duplicateIds) => mergeMutation.mutate({ primaryId, duplicateIds })}
                onClose={() => setShowDuplicates(false)}
              />
            ) : aggregatedPrompt !== null ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="text-sm font-semibold text-foreground">Aggregated Prompt</h2>
                  <div className="flex items-center gap-2">
                    <button
                      data-testid="button-copy-aggregate"
                      onClick={() => handleCopy(aggregatedPrompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
                    </button>
                    <button
                      data-testid="button-close-aggregate"
                      onClick={() => setAggregatedPrompt(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{aggregatedPrompt}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : selectedStory ? (
              <StoryPromptPanel
                story={selectedStory}
                epic={epics.find(e => e.id === selectedStory.epicId)}
                onPromptGenerated={() => invalidateAll()}
                onCopy={handleCopy}
                copied={copied}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <FileText size={48} className="text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Select a Story</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Click on an in-progress story from the left panel, then click "Generate Prompt" to have Claude create an implementation prompt for Claude Code.
                  Use the checkboxes to select stories, then click "Aggregate Prompts" to combine them.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StoryPromptPanel({ story, epic, onPromptGenerated, onCopy, copied }: {
  story: Story; epic?: Epic;
  onPromptGenerated: () => void;
  onCopy: (text: string) => void; copied: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [promptText, setPromptText] = useState(story.prompt || "");
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPromptText(story.prompt || "");
    setStreamingText("");
  }, [story.id, story.prompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText]);

  const handleGenerate = async () => {
    setGenerating(true);
    setStreamingText("");
    setPromptText("");

    try {
      const res = await fetch(`/api/stories/${story.id}/generate-prompt`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              fullText += data.text;
              setStreamingText(fullText);
            } else if (data.type === "done") {
              setPromptText(data.prompt);
              setStreamingText("");
              onPromptGenerated();
              toast({ title: "Prompt generated and saved" });
            } else if (data.type === "error") {
              toast({ title: "Generation failed", description: data.error, variant: "destructive" });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Failed to generate prompt", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const displayText = generating ? streamingText : promptText;
  const hasPrompt = !!displayText;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{story.title}</h2>
            {epic && <p className="text-xs text-muted-foreground">{epic.title}</p>}
          </div>
          <div className="flex items-center gap-2">
            {hasPrompt && !generating && (
              <button
                data-testid="button-copy-prompt"
                onClick={() => onCopy(displayText)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            )}
            <button
              data-testid="button-generate-prompt"
              onClick={handleGenerate}
              disabled={generating}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                generating
                  ? "bg-primary/10 text-primary"
                  : "bg-primary text-white hover:bg-primary/90"
              )}
            >
              {generating ? (
                <><Loader2 size={14} className="animate-spin" /> Generating...</>
              ) : hasPrompt ? (
                <><RefreshCw size={14} /> Regenerate</>
              ) : (
                <><Sparkles size={14} /> Generate Prompt</>
              )}
            </button>
          </div>
        </div>
      </div>

      <details className="border-b border-border bg-background px-4 py-2 shrink-0">
        <summary className="text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-1">
          <ChevronRight size={12} />
          Story Details (Description &amp; Acceptance Criteria)
        </summary>
        <div className="mt-2 space-y-2 pb-2 max-h-[200px] overflow-auto">
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-foreground"><strong>Description:</strong> {story.description || "—"}</p>
          </div>
          {story.acceptanceCriteria && (
            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Acceptance Criteria:</p>
              <div className="prose prose-sm max-w-none pl-2 border-l-2 border-border">
                <ReactMarkdown>{story.acceptanceCriteria}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </details>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {hasPrompt ? (
          <div ref={scrollRef} className="flex-1 overflow-auto p-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{displayText}</ReactMarkdown>
            </div>
            {generating && (
              <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Sparkles size={40} className="text-primary/20 mb-4" />
            <h3 className="text-base font-semibold text-foreground">Generate Implementation Prompt</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Click "Generate Prompt" to have Claude analyze this story and create an implementation prompt for Claude Code.
            </p>
            <button
              data-testid="button-generate-prompt-cta"
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <Sparkles size={16} /> Generate Prompt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DuplicatePanel({ groups, stories, epics, onMerge, onClose }: {
  groups: { primary: number; duplicates: number[]; reason: string }[];
  stories: Story[]; epics: Epic[];
  onMerge: (primaryId: number, duplicateIds: number[]) => void;
  onClose: () => void;
}) {
  const storyMap = new Map(stories.map(s => [s.id, s]));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-amber-50/50">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Merge size={16} className="text-amber-600" /> Potential Duplicates
          </h2>
          <p className="text-xs text-muted-foreground">{groups.length} group{groups.length !== 1 ? "s" : ""} found</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-duplicates">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
            <p className="text-sm text-foreground font-medium">No duplicates found</p>
            <p className="text-xs text-muted-foreground mt-1">All stories appear to be unique</p>
          </div>
        ) : (
          groups.map((group, gi) => {
            const primary = storyMap.get(group.primary);
            if (!primary) return null;
            const dupes = group.duplicates.map(id => storyMap.get(id)).filter(Boolean) as Story[];

            return (
              <div key={gi} className="glass-card rounded-xl p-4" data-testid={`duplicate-group-${gi}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{group.reason}</span>
                  <button
                    data-testid={`button-merge-group-${gi}`}
                    onClick={() => onMerge(group.primary, group.duplicates)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    <Merge size={12} /> Merge into Primary
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">PRIMARY</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{primary.title}</p>
                      {primary.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{primary.description}</p>}
                    </div>
                  </div>
                  {dupes.map(d => (
                    <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border">
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">DUPE</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{d.title}</p>
                        {d.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
