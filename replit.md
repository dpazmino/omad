# BMad Method - OpenAI Edition

## Overview
A web-based implementation of the BMad Method (Build More Architect Dreams), an AI-driven agile development framework. This version replaces the original CLI/skills-based approach with a full web UI powered by OpenAI via Replit AI Integrations.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind v4 + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 model)
- **Styling**: Dark theme with glassmorphism ("Dark Future" aesthetic)

## Key Features
- **7 BMad Agents**: Winston (Architect), John (PM), Mary (Analyst), Sally (UX), Bob (Scrum Master), DevAI (Developer), Quinn (QA)
- **Real-time Chat**: Streaming SSE responses from OpenAI with agent personas
- **Party Mode**: Multiple agents collaborate and respond sequentially
- **Session Management**: Persistent chat sessions with message history
- **Workflow Guide**: Visual reference for the 4-phase BMad development lifecycle

## File Structure
```
client/src/
  pages/Home.tsx          - Main chat interface with streaming
  pages/Agents.tsx        - Agent team dashboard
  pages/Workflows.tsx     - BMad workflow reference
  components/layout/      - Sidebar, Layout
  lib/api.ts              - API client functions

server/
  routes.ts               - API routes (agents, sessions, chat, workflows)
  storage.ts              - Database storage layer (Drizzle)
  agents.ts               - BMad agent definitions and system prompts
  db.ts                   - Database connection

shared/
  schema.ts               - Drizzle schema (agents, sessions, messages, workflows)

server/replit_integrations/  - OpenAI integration modules (chat, audio, image, batch)
```

## Database Tables
- `agents` - BMad agent configurations (name, persona, model, commands)
- `sessions` - Chat sessions with active agent and party mode toggle
- `messages` - Chat message history with agent attribution
- `workflows` - Workflow tracking (status, steps, phase)

## Environment
- OpenAI access via `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-configured)
- Database via `DATABASE_URL` (auto-configured)
- No user API keys required

## Fonts
- Outfit (headings), Inter (body), JetBrains Mono (code)
