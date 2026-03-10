import { db } from "./db";
import { agents, sessions, messages, workflows, projects, documents, epics, sprints, stories, type Agent, type InsertAgent, type Session, type InsertSession, type ChatMessage, type InsertMessage, type Workflow, type InsertWorkflow, type Project, type InsertProject, type Document, type InsertDocument, type Epic, type InsertEpic, type Sprint, type InsertSprint, type Story, type InsertStory } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  getAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent>;

  getSessions(): Promise<Session[]>;
  getSessionsByProject(projectId: number): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, data: Partial<InsertSession>): Promise<Session>;
  deleteSession(id: number): Promise<void>;

  getMessages(sessionId: number): Promise<ChatMessage[]>;
  createMessage(message: InsertMessage): Promise<ChatMessage>;

  getWorkflows(): Promise<Workflow[]>;
  getWorkflowsBySession(sessionId: number): Promise<Workflow[]>;
  getWorkflowsByProject(projectId: number): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, data: Partial<InsertWorkflow>): Promise<Workflow>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getDocumentsByProject(projectId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, data: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  getEpicsByProject(projectId: number): Promise<Epic[]>;
  getEpic(id: number): Promise<Epic | undefined>;
  createEpic(epic: InsertEpic): Promise<Epic>;
  updateEpic(id: number, data: Partial<InsertEpic>): Promise<Epic>;
  deleteEpic(id: number): Promise<void>;

  getSprintsByProject(projectId: number): Promise<Sprint[]>;
  getSprint(id: number): Promise<Sprint | undefined>;
  createSprint(sprint: InsertSprint): Promise<Sprint>;
  updateSprint(id: number, data: Partial<InsertSprint>): Promise<Sprint>;
  deleteSprint(id: number): Promise<void>;

  getStoriesByProject(projectId: number): Promise<Story[]>;
  getStoriesByEpic(epicId: number): Promise<Story[]>;
  getStoriesBySprint(sprintId: number): Promise<Story[]>;
  getStory(id: number): Promise<Story | undefined>;
  createStory(story: InsertStory): Promise<Story>;
  updateStory(id: number, data: Partial<InsertStory>): Promise<Story>;
  deleteStory(id: number): Promise<void>;
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

  async getSessionsByProject(projectId: number): Promise<Session[]> {
    return db.select().from(sessions).where(eq(sessions.projectId, projectId)).orderBy(desc(sessions.updatedAt));
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

  async getWorkflowsByProject(projectId: number): Promise<Workflow[]> {
    return db.select().from(workflows).where(eq(workflows.projectId, projectId)).orderBy(workflows.createdAt);
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [created] = await db.insert(workflows).values(workflow).returning();
    return created;
  }

  async updateWorkflow(id: number, data: Partial<InsertWorkflow>): Promise<Workflow> {
    const [updated] = await db.update(workflows).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(workflows.id, id)).returning();
    return updated;
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project> {
    const [updated] = await db.update(projects).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    const projectSessions = await db.select().from(sessions).where(eq(sessions.projectId, id));
    for (const s of projectSessions) {
      await db.delete(messages).where(eq(messages.sessionId, s.id));
    }
    await db.delete(documents).where(eq(documents.projectId, id));
    await db.delete(sessions).where(eq(sessions.projectId, id));
    await db.delete(workflows).where(eq(workflows.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getDocumentsByProject(projectId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: number, data: Partial<InsertDocument>): Promise<Document> {
    const [updated] = await db.update(documents).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(documents.id, id)).returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getEpicsByProject(projectId: number): Promise<Epic[]> {
    return db.select().from(epics).where(eq(epics.projectId, projectId)).orderBy(epics.createdAt);
  }

  async getEpic(id: number): Promise<Epic | undefined> {
    const [epic] = await db.select().from(epics).where(eq(epics.id, id));
    return epic;
  }

  async createEpic(epic: InsertEpic): Promise<Epic> {
    const [created] = await db.insert(epics).values(epic).returning();
    return created;
  }

  async updateEpic(id: number, data: Partial<InsertEpic>): Promise<Epic> {
    const [updated] = await db.update(epics).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(epics.id, id)).returning();
    return updated;
  }

  async deleteEpic(id: number): Promise<void> {
    await db.delete(stories).where(eq(stories.epicId, id));
    await db.delete(epics).where(eq(epics.id, id));
  }

  async getSprintsByProject(projectId: number): Promise<Sprint[]> {
    return db.select().from(sprints).where(eq(sprints.projectId, projectId)).orderBy(sprints.createdAt);
  }

  async getSprint(id: number): Promise<Sprint | undefined> {
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, id));
    return sprint;
  }

  async createSprint(sprint: InsertSprint): Promise<Sprint> {
    const [created] = await db.insert(sprints).values(sprint).returning();
    return created;
  }

  async updateSprint(id: number, data: Partial<InsertSprint>): Promise<Sprint> {
    const [updated] = await db.update(sprints).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(sprints.id, id)).returning();
    return updated;
  }

  async deleteSprint(id: number): Promise<void> {
    await db.update(stories).set({ sprintId: null }).where(eq(stories.sprintId, id));
    await db.delete(sprints).where(eq(sprints.id, id));
  }

  async getStoriesByProject(projectId: number): Promise<Story[]> {
    return db.select().from(stories).where(eq(stories.projectId, projectId)).orderBy(stories.createdAt);
  }

  async getStoriesByEpic(epicId: number): Promise<Story[]> {
    return db.select().from(stories).where(eq(stories.epicId, epicId)).orderBy(stories.createdAt);
  }

  async getStoriesBySprint(sprintId: number): Promise<Story[]> {
    return db.select().from(stories).where(eq(stories.sprintId, sprintId)).orderBy(stories.createdAt);
  }

  async getStory(id: number): Promise<Story | undefined> {
    const [story] = await db.select().from(stories).where(eq(stories.id, id));
    return story;
  }

  async createStory(story: InsertStory): Promise<Story> {
    const [created] = await db.insert(stories).values(story).returning();
    return created;
  }

  async updateStory(id: number, data: Partial<InsertStory>): Promise<Story> {
    const [updated] = await db.update(stories).set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(stories.id, id)).returning();
    return updated;
  }

  async deleteStory(id: number): Promise<void> {
    await db.delete(stories).where(eq(stories.id, id));
  }
}

export const storage = new DatabaseStorage();
