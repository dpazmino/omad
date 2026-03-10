import { db } from "./db";
import { agents, sessions, messages, workflows, type Agent, type InsertAgent, type Session, type InsertSession, type ChatMessage, type InsertMessage, type Workflow, type InsertWorkflow } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent>;

  getSessions(): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, data: Partial<InsertSession>): Promise<Session>;
  deleteSession(id: number): Promise<void>;

  getMessages(sessionId: number): Promise<ChatMessage[]>;
  createMessage(message: InsertMessage): Promise<ChatMessage>;

  getWorkflows(): Promise<Workflow[]>;
  getWorkflowsBySession(sessionId: number): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, data: Partial<InsertWorkflow>): Promise<Workflow>;
}

class DatabaseStorage implements IStorage {
  async getAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(agents.createdAt);
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent> {
    const [updated] = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return updated;
  }

  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions).orderBy(desc(sessions.updatedAt));
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [created] = await db.insert(sessions).values(session).returning();
    return created;
  }

  async updateSession(id: number, data: Partial<InsertSession>): Promise<Session> {
    const [updated] = await db.update(sessions).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(sessions.id, id)).returning();
    return updated;
  }

  async deleteSession(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.sessionId, id));
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async getMessages(sessionId: number): Promise<ChatMessage[]> {
    return db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<ChatMessage> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getWorkflows(): Promise<Workflow[]> {
    return db.select().from(workflows).orderBy(desc(workflows.updatedAt));
  }

  async getWorkflowsBySession(sessionId: number): Promise<Workflow[]> {
    return db.select().from(workflows).where(eq(workflows.sessionId, sessionId)).orderBy(workflows.createdAt);
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [created] = await db.insert(workflows).values(workflow).returning();
    return created;
  }

  async updateWorkflow(id: number, data: Partial<InsertWorkflow>): Promise<Workflow> {
    const [updated] = await db.update(workflows).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(workflows.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
