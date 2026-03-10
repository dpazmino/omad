import type { Agent, Session, ChatMessage } from "@shared/schema";

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

export async function createSession(title?: string): Promise<Session> {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
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
