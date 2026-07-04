# ResearchFlow Agent

ResearchFlow Agent is an AI product MVP for early-stage academic research planning. It turns a vague research idea into a traceable paper-planning workflow: scope clarification, source-linked paper search, evidence extraction, gap analysis, blueprint writing, and Reviewer challenge.

The main user-facing output is `paper-blueprint.md`. Internal JSON artifacts are kept for agent handoff and auditability, not as the primary deliverable.

## What Is Implemented

- Next.js App Router workspace with a chat-first product surface.
- Lightweight local account gate using `/api/auth/register` and `/api/auth/login`.
- Project and conversation persistence through a local JSON product store.
- Orchestrator decision loop for routing, tool calls, clarification pauses, resume, and final quality gates.
- Server-side OpenAI Responses API calls for agent steps and conversation routing.
- Live paper metadata search through OpenAlex, Semantic Scholar, and Crossref provider adapters.
- Run polling APIs, paused-run resume, tool traces, and final artifact cards.
- Run artifacts written under `sample-project/runs/<runId>/` locally, and versioned artifact records in the product store.
- Documentation for agent contracts, artifact schemas, skill registry, and workflow rules.

## Quick Tryout

1. Open the deployed `/workspace` URL.
2. Register a temporary account or sign in.
3. Create a project, or use the default Research inbox.
4. Try this prompt:

```text
Please help me turn this vague research idea into a complete paper blueprint: I want to study how transit-oriented development around urban rail stations affects land use and resident travel behavior, but I am not sure how to narrow the scope.
```

5. Watch the ResearchFlow message for Orchestrator decisions, agent logs, tool traces, and the final `paper-blueprint.md` file card.
6. Open the project page to inspect recent runs, the latest blueprint, and internal agent outputs.

## Agent I/O Contract

| Agent | Main input | Output artifact | Saved where | User visibility |
| --- | --- | --- | --- | --- |
| Orchestrator | User topic, recent conversation, existing artifacts, tool traces, quality gates | Routing decisions and `revision-log.json` | Run snapshot and artifact store | Decision summaries in chat |
| Clarifier Agent | Vague topic, history, `scope-clarification-skill` | `research-brief.json` | `sample-project/runs/<runId>/internal/` and product store | Inspectable on project page |
| Research Agent | Research brief, live search context, paper/evidence/gap skills | `paper-pool.json`, `evidence-pack.json`, `gap-analysis.json` | `sample-project/runs/<runId>/internal/` and product store | Tool traces in chat, JSON inspectable |
| Writer/Compiler Agent | Brief, paper pool, evidence pack, gap analysis, reviewer notes | `paper-blueprint.md` | `sample-project/runs/<runId>/` and product store | Main user-facing file |
| Reviewer Agent | Blueprint, evidence artifacts, `review-challenge-skill` | `review-notes.json` | `sample-project/runs/<runId>/internal/` and product store | Summary in chat, JSON inspectable |

## Artifact Contract

The workflow is intentionally artifact-driven:

- `research-brief.json`: topic, objective, scope, keywords, exclusions, success criteria.
- `paper-pool.json`: source-linked paper candidates, provider status, selection reasons, coverage gaps, next queries.
- `evidence-pack.json`: structured methods, variables, findings, and limitations.
- `gap-analysis.json`: candidate gaps, selected gap, why selected, evidence needs.
- `paper-blueprint.md`: title, abstract structure, background logic, literature map, questions, framework, data, methods, contribution, risks, next writing tasks.
- `review-notes.json`: classified Reviewer issues and routing hints.
- `revision-log.json`: what changed, why, which agent handled it, and quality-gate status.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill server-side keys locally. Do not commit `.env.local`.

```bash
cp .env.example .env.local
```

Required for model-backed runs:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_ROUTER_MODEL`

Optional for better literature search:

- `OPENALEX_API_KEY`
- `SEMANTIC_SCHOLAR_API_KEY`
- `CROSSREF_MAILTO`

## Deployment Notes

Deploy with Vercel and configure the same environment variables in Project Settings -> Environment Variables. The browser only calls this app's own `/api/*` routes; provider keys stay server-side.

The current local JSON store and `/tmp` runtime storage are prototype persistence for the MVP. A production version should move users, projects, runs, and artifacts to Postgres through Prisma.

## Security Notes

- `.env*`, `.data/`, `sample-project/runs/`, generated Next folders, logs, and TypeScript build info are ignored.
- If a real key was ever present in local files or shared logs, rotate it before deploying.
- Do not create `NEXT_PUBLIC_OPENAI_API_KEY` or any public provider key.

## Validation

```bash
npm run typecheck
npm run lint
```

The primary acceptance flow is:

1. Register or log in.
2. Create a project.
3. Run a full blueprint prompt.
4. Refresh the page and confirm projects/conversations remain.
5. Open the generated `paper-blueprint.md`.
6. Open the project page and inspect internal agent outputs.
