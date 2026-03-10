# BMad Method - OpenAI Edition

## Overview
A web-based implementation of the BMad Method (Build More Architect Dreams), an AI-driven agile development framework. This version replaces the original CLI/skills-based approach with a full web UI powered by OpenAI via Replit AI Integrations.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind v4 + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 model)
- **Styling**: Professional light banking theme — navy primary (hsl 215 75% 30%), teal accent (hsl 168 55% 35%), off-white backgrounds, white cards with subtle shadows

## Key Features
- **Projects**: Central organizing concept — each project has its own sessions, workflows, and phase tracking
- **7 BMad Agents**: Winston (Architect), John (PM), Mary (Analyst), Sally (UX), Bob (Scrum Master), DevAI (Developer), Quinn (QA)
- **Real-time Chat**: Streaming SSE responses from OpenAI with agent personas (project-scoped)
- **Interactive Responses**: Agent responses with questions/choices are parsed into interactive UI (radio buttons for MC, text inputs for open-ended). Located in `client/src/components/InteractiveResponse.tsx`
- **Party Mode**: All active agents collaborate and respond sequentially
- **Documents Panel**: Right-side panel shows auto-detected project artifacts (product briefs, PRDs, architecture docs, etc.)
  - Auto-detection via `DOCUMENT_PATTERNS` regex in `server/routes.ts` after each agent response
  - Manual scan via `/api/projects/:id/scan-documents` endpoint
  - Documents stored in `documents` table with project/session/message references
  - Panel supports viewing full document content, deleting, and scanning existing conversations
- **Workflow Guide**: Visual reference for the 4-phase BMad development lifecycle per project
- **Phase Tracking**: Projects track their current BMad phase (analysis → planning → solutioning → implementation)

## File Structure
```
client/src/
  pages/Home.tsx          - Main chat interface (standalone, no project)
  pages/Agents.tsx        - Agent team dashboard
  pages/Workflows.tsx     - BMad workflow reference (global)
  pages/Projects.tsx      - Project listing dashboard
  pages/ProjectDetail.tsx - Project detail with chat + workflows tabs
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

server/replit_integrations/  - OpenAI integration modules (chat, audio, image, batch)
```

## Database Tables
- `agents` - BMad agent configurations (name, persona, model, commands)
- `projects` - Development projects (name, description, status, phase)
- `sessions` - Chat sessions scoped to projects (projectId FK)
- `messages` - Chat message history with agent attribution
- `workflows` - Workflow tracking scoped to projects (projectId FK)
- `documents` - Auto-detected project artifacts (title, docType, content, agentName, phase, projectId, sessionId, messageId)

## Data Model
- Projects are the top-level entity
- Sessions belong to a project (via `projectId` column)
- Workflows belong to a project (via `projectId` column)
- Documents belong to a project (via `projectId` column, cascade delete)
- Messages belong to a session
- Deleting a project cascades to its sessions, messages, workflows, and documents

## Environment
- OpenAI access via `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-configured)
- Database via `DATABASE_URL` (auto-configured)
- No user API keys required

## Fonts
- Outfit (headings), Inter (body), JetBrains Mono (code)

## Important Notes
- `Link` from wouter renders an `<a>` — do NOT wrap it in another `<a>` tag
- Sidebar nav order: Projects, Chat, Agents, Workflows
