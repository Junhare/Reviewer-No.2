# RESUME_BRIEF

## Current Phase

Phase 5 in progress: the core Phase 4 Agent harness is complete, and the next work is hardening live paper search through Semantic Scholar and Crossref.

## Completed

- Project charter and governing docs created.
- TOD station-area research selected as the default sample project.
- Agent responsibilities, skill registry, artifact schemas, and workflow rules defined.
- Next.js workspace and project pages implemented.
- `/workspace` refactored into a Codex-style chat workspace with left sidebar, central conversation, bottom composer, Agent status, and final artifact card.
- `paper-blueprint.md` is the single main user-facing artifact.
- Intermediate Agent outputs are stored as internal JSON artifacts.
- Local Agent harness added under `src/lib/agent-harness.ts`.
- `POST /api/runs` creates runs from user input.
- `GET /api/runs/[runId]` reads run snapshots.
- The workspace polls the run API instead of using frontend-only timers.
- Server-side OpenAI Responses API calls are used for Agent steps.
- Multi-turn conversation history and session memory are supported.
- Orchestrator routes user turns into `clarify`, `research`, `write`, `review`, `revise`, `status`, or `full_workflow`.
- Full workflow runs write generated artifacts under `sample-project/runs/<runId>/`.
- Final file cards point to `/api/artifacts/<runId>/paper-blueprint.md`.
- Orchestrator now uses a bounded runtime decision loop rather than fixed step playback.
- Orchestrator can call tools, run Agents, ask the user for clarification, or finish.
- `waiting_for_user` run status is supported.
- `POST /api/runs/[runId]/resume` resumes a paused run with the same `runId`.
- Writer readiness gate and Final quality gate are implemented with structured `QualityGateResult`.
- Active code paths were cleaned up with readable UTF-8 Chinese copy.
- Crossref polite-pool email is configured in `.env.local`.
- Live paper search provider code exists for Semantic Scholar and Crossref in `src/lib/research-tools.ts`.

## Not Completed

- Semantic Scholar API key is optional and has not been configured yet.
- Live paper search still needs stronger fallback, deduplication, quality scoring, and gate integration.
- Run state is still in memory; paused runs are lost after server restart.
- PDF/DOCX export is not implemented.
- Screenshot-based browser QA has not been completed in this environment.
- Deployment is not needed yet; deploy after Phase 5 and run persistence are stable.

## Next Window Should Start With

1. Harden `src/lib/research-tools.ts` so Semantic Scholar and Crossref results are deduplicated, filtered, scored, and summarized.
2. Add fallback behavior when live search returns too few usable papers.
3. Update Writer gate so it checks live search quality, not just provider completion.
4. Run typecheck and lint for changed files.
5. After Phase 5, persist active run snapshots to disk or a lightweight database.

## Suggested Demo Checks

Use clear UTF-8 prompts:

- `我想研究 TOD 模式下城市轨道交通站点周边土地利用与居民出行行为，请帮我生成完整论文框架。`
- `你觉得这个选题范围是不是太大？`
- `你对刚才生成的论文框架有哪些风险判断？`
- `请继续完善方法设计和变量设计。`
