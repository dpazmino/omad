# BMad Method - Claude Edition

## Overview
A web-based implementation of the BMad Method (Build More Architect Dreams), an AI-driven agile development framework. This version replaces the original CLI/skills-based approach with a full web UI powered by Anthropic Claude via Replit AI Integrations.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind v4 + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Anthropic Claude via Replit AI Integrations (claude-sonnet-4-6 model, 200K context window)
- **Styling**: Corporate banking theme — deep navy primary (hsl 215 70% 25%), teal accent (hsl 198 50% 32%), dark navy sidebar (hsl 215 55% 16%), Inter font throughout, tight 0.375rem radius, clean card borders (no glassmorphism), restrained hover effects. No Outfit font, no emojis in agent avatars (uses initials instead)

## Key Features
- **Projects**: Central organizing concept — each project has its own sessions, workflows, and phase tracking
- **9 BMad Agents**: Winston (Architect), John (PM), Mary (Analyst), Sally (UX), Bob (Scrum Master), DevAI (Developer), Quinn (QA), Fred (Senior Scrum Master — sprint planning, dependency analysis), Allie (Story Analyst — INVEST framework analysis)
- **Real-time Chat**: Streaming SSE responses from Claude with agent personas (project-scoped)
- **Interactive Responses**: Agent responses with questions/choices are parsed into interactive UI (radio buttons for MC, text inputs for open-ended). Located in `client/src/components/InteractiveResponse.tsx`
- **Party Mode**: All active agents collaborate and respond sequentially
- **Documents Panel**: Right-side panel shows auto-detected project artifacts (product briefs, PRDs, architecture docs, etc.)
  - Auto-detection via `DOCUMENT_PATTERNS` regex in `server/routes.ts` after each agent response
  - Manual scan via `/api/projects/:id/scan-documents` endpoint
  - Documents stored in `documents` table with project/session/message references
  - Panel supports viewing full document content, deleting, and scanning existing conversations
- **Command Prerequisites**: Commands check for required documents before executing (e.g., MR needs brainstorm, CP needs product-brief). Buttons show disabled with tooltip when prerequisites aren't met. When prerequisites are met, document content is automatically injected as context.
- **INVEST Analysis (Allie)**: Every story gets an INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable) analysis panel in the story detail modal. "Run INVEST" button calls Allie (Claude) to evaluate the story against all 6 criteria with pass/warn/fail scores and improvement suggestions. Results stored as `stories.investAnalysis` JSONB column. INVEST score badges (N/6) appear on story rows and kanban cards. Bulk analysis available via `/api/projects/:id/invest-all` (SSE). Phase 4 "Refinement" with IN command added between Solutioning and Implementation.
- **Workflow Guide**: Visual reference for the 5-phase BMad development lifecycle per project
- **Phase Tracking**: Projects track their current BMad phase (analysis → planning → solutioning → refinement → implementation)
- **Board View (Jira-like)**: Project board with epics, sprints, and stories. Accessible via "Board" tab in ProjectDetail. Features:
  - Epic list view with collapsible epics and story rows
  - Kanban board with 5-column layout (Backlog, To Do, In Progress, Review, Done)
  - Sprint filter to view stories by sprint
  - Story detail modal with full description, acceptance criteria, status/priority management
  - Inline create forms for epics, stories, and sprints
  - Import from CE (Create Epics) command output via `parseEpicsFromDocument()`
  - Component: `client/src/components/BoardView.tsx`
  - Story dependencies: `stories.dependsOn` integer array column tracks which stories a story depends on. Displayed as badges on story rows/cards, and in the story detail modal with linked story info.
  - Fred (Senior Scrum Master) chat panel: "Talk to Fred" button opens a slide-out chat within the Board view. Fred analyzes all stories, identifies dependencies and groupings, and recommends sprint assignments. Fred's responses can include a `\`\`\`dependencies` JSON block that the user can save directly to stories via a "Save Dependencies" button.
  - API: `/api/projects/:id/epics`, `/api/projects/:id/sprints`, `/api/projects/:id/stories`, `/api/projects/:id/import-epics`, `/api/projects/:id/fred-chat` (SSE), `/api/projects/:id/save-dependencies`
- **Dev View**: Focused screen for in-progress story development. Accessible from ProjectDetail "Dev View" link.
  - Shows all in-progress stories with prompt status
  - Per-story Claude Code prompt editor (saved to `stories.prompt` column)
  - Aggregate prompts: combines selected stories' prompts into a single markdown document for Claude Code
  - Duplicate story detection: word-overlap similarity analysis (>60% threshold)
  - Merge duplicates: consolidates descriptions/acceptance criteria into primary story
  - Page: `client/src/pages/DevView.tsx`
  - API: `/api/projects/:id/aggregate-prompts`, `/api/projects/:id/duplicate-stories`, `/api/stories/merge`

## File Structure
```
client/src/
  pages/Home.tsx          - Main chat interface (standalone, no project)
  pages/Agents.tsx        - Agent team dashboard
  pages/Workflows.tsx     - BMad workflow reference (global)
  pages/Projects.tsx      - Project listing dashboard
  pages/ProjectDetail.tsx - Project detail with chat + workflows tabs
  pages/DevView.tsx       - Dev View: in-progress stories, Claude Code prompts, duplicate detection, prompt aggregation
  components/InteractiveResponse.tsx - Parses agent Q&A into interactive UI
  components/layout/      - Sidebar, Layout
  lib/api.ts              - API client functions

server/
  routes.ts               - API routes (agents, sessions, chat, workflows, projects)
  storage.ts              - Database storage layer (Drizzle)
  agents.ts               - BMad agent definitions and system prompts
  db.ts                   - Database connection

shared/
  schema.ts               - Drizzle schema (agents, sessions, messages, workflows, projects)

server/replit_integrations/  - AI integration modules (chat, audio, image, batch)
```

## Database Tables
- `agents` - BMad agent configurations (name, persona, model, commands)
- `projects` - Development projects (name, description, status, phase)
- `sessions` - Chat sessions scoped to projects (projectId FK)
- `messages` - Chat message history with agent attribution
- `workflows` - Workflow tracking scoped to projects (projectId FK)
- `documents` - Auto-detected project artifacts (title, docType, content, agentName, phase, projectId, sessionId, messageId)
- `epics` - Project epics (title, description, status, priority, projectId FK)
- `sprints` - Project sprints (name, goal, status, startDate, endDate, projectId FK)
- `stories` - User stories (title, description, acceptanceCriteria, status, priority, storyPoints, assignee, prompt, mergedIntoStoryId, dependsOn int[], investAnalysis JSONB, epicId FK, sprintId FK nullable, projectId FK)

## Data Model
- Projects are the top-level entity
- Sessions belong to a project (via `projectId` column)
- Workflows belong to a project (via `projectId` column)
- Documents belong to a project (via `projectId` column, cascade delete)
- Epics belong to a project (via `projectId` column)
- Sprints belong to a project (via `projectId` column)
- Stories belong to an epic (via `epicId` column), optionally to a sprint (via `sprintId`), and to a project (via `projectId`)
- Messages belong to a session
- Deleting a project cascades to its sessions, messages, workflows, and documents

## Environment
- Anthropic Claude access via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (auto-configured)
- Database via `DATABASE_URL` (auto-configured)
- No user API keys required

## Fonts
- Inter (all text), JetBrains Mono (code)

## Important Notes
- `Link` from wouter renders an `<a>` — do NOT wrap it in another `<a>` tag
- Sidebar nav order: Projects, Chat, Agents, Workflows
