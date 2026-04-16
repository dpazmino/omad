const GH_API = "https://api.github.com";
const MAX_TREE_ENTRIES = 400;
const MAX_FILE_BYTES = 40_000;

export type RepoSnapshot = {
  owner: string;
  repo: string;
  url: string;
  description: string;
  language: string | null;
  topics: string[];
  defaultBranch: string;
  stars: number;
  license: string | null;
  isPrivate: boolean;
  readme: string;
  fileTree: string;
  keyFiles: { path: string; content: string }[];
};

export class PrivateRepoError extends Error {
  constructor(slug: string) {
    super(`Repository ${slug} is private. Only public repositories can be imported.`);
    this.name = "PrivateRepoError";
  }
}

function ghHeaders(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bmad-web-ui",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export function parseRepoUrl(raw: string): { owner: string; repo: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  // Support: https://github.com/owner/repo, github.com/owner/repo, owner/repo, git@github.com:owner/repo
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  const httpMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/.*)?$/i);
  if (httpMatch) return { owner: httpMatch[1], repo: httpMatch[2] };
  const simpleMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (simpleMatch) return { owner: simpleMatch[1], repo: simpleMatch[2] };
  return null;
}

async function ghJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function ghRaw(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) return null;
  return res.text();
}

async function fetchReadme(owner: string, repo: string): Promise<string> {
  try {
    const data = await ghJson<{ content: string; encoding: string }>(`${GH_API}/repos/${owner}/${repo}/readme`);
    if (data?.content) {
      const buf = Buffer.from(data.content, (data.encoding as BufferEncoding) || "base64");
      return buf.toString("utf-8").slice(0, 20_000);
    }
  } catch {}
  return "";
}

async function fetchTree(owner: string, repo: string, branch: string): Promise<{ path: string; size?: number; type: string }[]> {
  try {
    const data = await ghJson<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
      `${GH_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    );
    return (data.tree || []).slice(0, MAX_TREE_ENTRIES);
  } catch {
    return [];
  }
}

function summarizeTree(entries: { path: string; type: string }[]): string {
  const dirs = new Set<string>();
  const files: string[] = [];
  for (const e of entries) {
    if (e.type === "tree") dirs.add(e.path);
    else files.push(e.path);
  }
  // Show top-level dirs + all files (paths only, limited)
  const topDirs = Array.from(dirs).filter((d) => !d.includes("/")).sort();
  const lines: string[] = [];
  if (topDirs.length) {
    lines.push("Top-level directories:");
    for (const d of topDirs) lines.push(`  ${d}/`);
  }
  lines.push("");
  lines.push(`Files (up to ${MAX_TREE_ENTRIES}):`);
  for (const f of files.slice(0, MAX_TREE_ENTRIES)) lines.push(`  ${f}`);
  return lines.join("\n");
}

const KEY_FILE_CANDIDATES = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "composer.json",
  "Dockerfile",
  "docker-compose.yml",
  ".tool-versions",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
];

async function fetchKeyFile(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
  const raw = await ghRaw(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
  if (!raw) return null;
  return raw.length > MAX_FILE_BYTES ? raw.slice(0, MAX_FILE_BYTES) + "\n... [truncated]" : raw;
}

export async function fetchRepoSnapshot(owner: string, repo: string): Promise<RepoSnapshot> {
  const meta = await ghJson<any>(`${GH_API}/repos/${owner}/${repo}`);
  if (meta?.private === true) {
    throw new PrivateRepoError(`${owner}/${repo}`);
  }
  const defaultBranch = meta.default_branch || "main";

  const [readme, tree] = await Promise.all([
    fetchReadme(owner, repo),
    fetchTree(owner, repo, defaultBranch),
  ]);

  const existingPaths = new Set(tree.filter((e) => e.type === "blob").map((e) => e.path));
  const keyFiles: { path: string; content: string }[] = [];
  for (const candidate of KEY_FILE_CANDIDATES) {
    if (!existingPaths.has(candidate)) continue;
    const content = await fetchKeyFile(owner, repo, defaultBranch, candidate);
    if (content) keyFiles.push({ path: candidate, content });
    if (keyFiles.length >= 6) break;
  }

  return {
    owner,
    repo,
    url: meta.html_url || `https://github.com/${owner}/${repo}`,
    description: meta.description || "",
    language: meta.language || null,
    topics: meta.topics || [],
    defaultBranch,
    stars: meta.stargazers_count || 0,
    license: meta.license?.spdx_id || null,
    readme,
    fileTree: summarizeTree(tree),
    keyFiles,
  };
}

export function buildRepoContextBlock(snap: RepoSnapshot): string {
  const parts: string[] = [];
  parts.push(`# Repository Snapshot: ${snap.owner}/${snap.repo}`);
  parts.push(`URL: ${snap.url}`);
  if (snap.description) parts.push(`Description: ${snap.description}`);
  if (snap.language) parts.push(`Primary language: ${snap.language}`);
  if (snap.topics.length) parts.push(`Topics: ${snap.topics.join(", ")}`);
  if (snap.license) parts.push(`License: ${snap.license}`);
  parts.push(`Default branch: ${snap.defaultBranch}`);
  parts.push("");
  if (snap.readme) {
    parts.push("## README (truncated)");
    parts.push(snap.readme);
    parts.push("");
  }
  parts.push("## File Tree");
  parts.push(snap.fileTree);
  parts.push("");
  if (snap.keyFiles.length) {
    parts.push("## Key Config Files");
    for (const f of snap.keyFiles) {
      parts.push(`### ${f.path}`);
      parts.push("```");
      parts.push(f.content);
      parts.push("```");
      parts.push("");
    }
  }
  return parts.join("\n");
}
