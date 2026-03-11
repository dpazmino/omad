import { sql } from "drizzle-orm";
import { pgTable, serial, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  icon: text("icon").notNull(),
  role: text("role").notNull(),
  identity: text("identity").notNull(),
  communicationStyle: text("communication_style").notNull(),
  principles: text("principles").notNull(),
  capabilities: text("capabilities").notNull(),
  model: text("model").notNull().default("gpt-5.2"),
  status: text("status").notNull().default("active"),
  isDefault: boolean("is_default").notNull().default(false),
  menuCommands: jsonb("menu_commands").$type<{ trigger: string; description: string }[]>().default([]),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  phase: text("phase").notNull().default("analysis"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  activeAgentId: integer("active_agent_id").references(() => agents.id),
  partyMode: boolean("party_mode").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  agentName: text("agent_name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  phase: text("phase").notNull(),
  status: text("status").notNull().default("pending"),
  steps: jsonb("steps").$type<{ name: string; status: string }[]>().default([]),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  docType: text("doc_type").notNull(),
  content: text("content").notNull(),
  agentName: text("agent_name"),
  phase: text("phase").notNull().default("analysis"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const epics = pgTable("epics", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sprints = pgTable("sprints", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goal: text("goal").notNull().default(""),
  status: text("status").notNull().default("planning"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  epicId: integer("epic_id").notNull().references(() => epics.id, { onDelete: "cascade" }),
  sprintId: integer("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  storyPoints: integer("story_points"),
  assignee: text("assignee"),
  prompt: text("prompt"),
  mergedIntoStoryId: integer("merged_into_story_id"),
  dependsOn: integer("depends_on").array().default([]),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type ChatMessage = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export const insertEpicSchema = createInsertSchema(epics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSprintSchema = createInsertSchema(sprints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStorySchema = createInsertSchema(stories).omit({ id: true, createdAt: true, updatedAt: true });

export type Epic = typeof epics.$inferSelect;
export type InsertEpic = z.infer<typeof insertEpicSchema>;
export type Sprint = typeof sprints.$inferSelect;
export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
