import type { Agent, Session, ChatMessage, Project, Document } from "@shared/schema";

const API = "/api";

export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API}/agents`);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${API}/sessions`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function createSession(title?: string, projectId?: number): Promise<Session> {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, projectId }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function deleteSession(id: number): Promise<void> {
  await fetch(`${API}/sessions/${id}`, { method: "DELETE" });
}

export async function updateSession(id: number, data: Partial<Session>): Promise<Session> {
  const res = await fetch(`${API}/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update session");
  return res.json();
}

export async function fetchMessages(sessionId: number): Promise<ChatMessage[]> {
  const res = await fetch(`${API}/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export class GithubImportError extends Error {
  partial: boolean;
  projectId?: number;
  generated: { title: string; docType: string }[];
  constructor(message: string, opts: { partial?: boolean; projectId?: number; generated?: { title: string; docType: string }[] } = {}) {
    super(message);
    this.name = "GithubImportError";
    this.partial = !!opts.partial;
    this.projectId = opts.projectId;
    this.generated = opts.generated || [];
  }
}

export async function importGithubProject(repoUrl: string, intent?: string): Promise<{
  project: Project;
  repo: { owner: string; repo: string; url: string; defaultBranch: string };
  generated: { title: string; docType: string }[];
  message: string;
}> {
  const res = await fetch(`${API}/projects/import-github`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl, intent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GithubImportError(data.error || "Failed to import repository", {
      partial: data.partial,
      projectId: data.projectId,
      generated: data.generated,
    });
  }
  return data;
}

export async function fetchProjectSessions(projectId: number): Promise<Session[]> {
  const res = await fetch(`${API}/projects/${projectId}/sessions`);
  if (!res.ok) throw new Error("Failed to fetch project sessions");
  return res.json();
}

export async function fetchProjectWorkflows(projectId: number): Promise<any[]> {
  const res = await fetch(`${API}/projects/${projectId}/workflows`);
  if (!res.ok) throw new Error("Failed to fetch project workflows");
  return res.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API}/projects`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function createProject(data: { name: string; description?: string }): Promise<Project> {
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function updateProject(id: number, data: Partial<Project>): Promise<Project> {
  const res = await fetch(`${API}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function deleteProject(id: number): Promise<void> {
  await fetch(`${API}/projects/${id}`, { method: "DELETE" });
}

export async function fetchProjectDocuments(projectId: number): Promise<Document[]> {
  const res = await fetch(`${API}/projects/${projectId}/documents`);
  if (!res.ok) throw new Error("Failed to fetch project documents");
  return res.json();
}

export async function fetchDocument(id: number): Promise<Document> {
  const res = await fetch(`${API}/documents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function createDocument(projectId: number, data: { title: string; docType: string; content: string; agentName?: string; phase?: string; sessionId?: number; messageId?: number }): Promise<Document> {
  const res = await fetch(`${API}/projects/${projectId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create document");
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  await fetch(`${API}/documents/${id}`, { method: "DELETE" });
}

export async function scanProjectDocuments(projectId: number): Promise<{ scanned: number; documents: Document[] }> {
  const res = await fetch(`${API}/projects/${projectId}/scan-documents`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to scan documents");
  return res.json();
}

export async function fetchBmadHelp(): Promise<any> {
  const res = await fetch(`${API}/bmad-help`);
  if (!res.ok) throw new Error("Failed to fetch help");
  return res.json();
}

export type StreamEvent =
  | { type: "user_message"; message: ChatMessage }
  | { type: "content"; content: string; agentId?: number }
  | { type: "agent_start"; agentId: number; agentName: string }
  | { type: "agent_done"; agentId: number; message: ChatMessage }
  | { type: "done"; message?: ChatMessage }
  | { type: "error"; error: string };

export async function streamChat(
  sessionId: number,
  content: string,
  agentId: number | null,
  partyMode: boolean,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const endpoint = partyMode
    ? `${API}/sessions/${sessionId}/party-chat`
    : `${API}/sessions/${sessionId}/chat`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, agentId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Chat request failed" }));
    throw new Error(err.error || "Chat request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event: StreamEvent = JSON.parse(line.slice(6));
        onEvent(event);
      } catch {}
    }
  }
}
