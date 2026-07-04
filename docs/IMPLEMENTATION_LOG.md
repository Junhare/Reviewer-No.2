# IMPLEMENTATION_LOG

## 2026-06-15

Task: Implement initial ResearchFlow Agent project from the agreed plan.

Changed files:

- Created project docs under `/docs`.
- Created TOD sample artifacts under `/sample-project`.
- Created public artifact links under `/public/artifacts/tod`.
- Created Next.js static workspace and project pages.
- Created README.

Validation:

- `npm install` completed after retry and generated `package-lock.json`.
- `npm run lint` passed.
- `npm run build` passed with Next.js 16.2.9.
- Dev server started at `http://localhost:3000`.
- HTTP checks passed for `/workspace`, `/projects/tod-station-area`, and `/api/artifacts/tod-station-area/paper-pool.md`.

Issues:

- `create-next-app` timed out without generating files, so the project was scaffolded manually.
- Initial `.next` build output was locked by a failed build attempt, so `next.config.ts` uses `.next-build` as the build output directory.
- `agent-browser` CLI was unavailable. Bundled Playwright was also missing `playwright-core`, so final browser verification was limited to HTTP and content checks.

Next:

- Use a full browser environment later for screenshot-based visual QA.
- Continue with Phase 4 Agent harness when ready.

## 2026-06-19

Task: Implement the updated product model from multi-file kickoff package to one main paper blueprint.

Changed files:

- Replaced user-facing sample artifacts with `sample-project/paper-blueprint.md`.
- Moved intermediate materials into `sample-project/internal/*.json`.
- Updated `/workspace` to show Agent handoffs, skills, quality gates, and one final artifact.
- Updated `/projects/[id]` to emphasize `paper-blueprint.md` and summarize internal process.
- Updated artifact delivery to expose `paper-blueprint.md` as a stable public static file.
- Updated governance docs and skill registry for the new artifact model.

Validation:

- `npm run lint` passed.
- `npm run build` passed.
- Production server verification passed on `http://localhost:3003`.
- `/workspace` returns 200 and shows `paper-blueprint.md` plus `Main artifact`.
- `/projects/tod-station-area` returns 200 and shows `Blueprint sections` plus `Internal process`.
- `/artifacts/tod-station-area/paper-blueprint.md` returns 200 and contains the expected TOD paper blueprint content.

Issues:

- Previous `src/lib/demo-data.ts` and project page had garbled Chinese text; this step replaces those strings with clean UTF-8 content.
- The dynamic artifact API hung in local dev verification, so the final user artifact now uses a static public file route.

Next:

- Continue with Phase 4 Agent harness.
- Start with Orchestrator state model, quality gate, and revision routing.

## 2026-06-19

Task: Refactor `/workspace` into a Codex-style chat-first Agent interface.

Changed files:

- Replaced the dashboard-style workspace page with a client-side chat workspace.
- Added left sidebar for new chat, new project, recent projects, and discovery entries.
- Added central message stream where Orchestrator and specialist Agents appear as sequential messages.
- Added bottom composer that simulates a full Agent run after user submission.
- Added final `paper-blueprint.md` file card in the conversation.
- Added CSS for chat shell, sidebar, message stream, composer, and file card.

Validation:

- `npm run lint` passed.
- `npm run build` passed.
- Production server verification passed on `http://localhost:3004/workspace`.
- `/workspace` contains the chat-first header, bottom composer, left project sidebar, and no old `Orchestrator timeline` dashboard text.
- `/artifacts/tod-station-area/paper-blueprint.md` returns 200.

Issues:

- This is still a static/mocked chat run, not a live LLM or real Agent harness.

Next:

- Continue with Phase 4 Agent harness.
- Replace mocked timed messages with real Orchestrator state transitions.

## 2026-06-19

Task: Refine chat UX and workflow presentation based on product review.

Changed files:

- Added a right-side user avatar to chat messages.
- Rewrote Agent message copy into compact execution status language.
- Added small execution logs inside each Agent message, closer to a Codex-style running trace.
- Changed the mocked flow from a simple linear Agent sequence to an Orchestrator-driven workflow:
  Orchestrator calls one Agent, receives output, checks a quality gate, then decides the next Agent or revision route.
- Added Reviewer-driven revision routing in the chat run:
  `gap_issue -> Research Agent`, `method_issue -> Writer/Compiler Agent`.
- Kept the final output focused on a summary plus `paper-blueprint.md`.
- Updated build configuration to use webpack build output under `.next-webpack` because the Windows local environment repeatedly locked previous Next/Turbopack build files.
- Updated ESLint ignore rules so generated `.next-*` folders are not linted.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked Next's build subprocess with `spawn EPERM`.
- Local production server is available at `http://localhost:3005/workspace`.
- `/workspace` returns 200, contains the chat-first header and composer, and no longer contains old `Orchestrator timeline` dashboard text.
- `/artifacts/tod-station-area/paper-blueprint.md` returns 200 and contains the TOD paper blueprint content.

Issues:

- The current chat run is still a frontend simulation. It visually explains the intended Agent workflow, but Phase 4 still needs a real Orchestrator state machine.
- Screenshot-based browser QA is still not available in this environment.

Next:

- Continue with Phase 4 Agent harness.
- Start by implementing Orchestrator state transitions, quality gates, and revision routing as real data instead of timed mock messages.

## 2026-06-20

Task: Reduce `/workspace` Agent execution noise and make the response behave like one Codex-style status/result message.

Changed files:

- Updated `src/components/workspace-chat.tsx` so the mock run no longer appends every Orchestrator/Agent step as a separate chat bubble.
- Replaced the verbose per-Agent stream with one `ResearchFlow` response message that updates in place while the workflow is thinking.
- Changed the completed state to a compact result summary: time used, completed work, changed artifact, validation result, and the final `paper-blueprint.md` file card.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked `.next-webpack` cleanup with `EPERM`.
- Production server started at `http://localhost:3007`.
- `/workspace`, `/projects/tod-station-area`, and `/artifacts/tod-station-area/paper-blueprint.md` returned 200.

Issues:

- Browser screenshot automation is still unavailable in this environment.
- The chat run remains a frontend simulation until Phase 4 replaces it with real Orchestrator state transitions.

Next:

- Continue with Phase 4 Agent harness.
- Start by implementing a real Orchestrator state model, quality gate evaluator, and revision routing data flow behind the chat UI.

## 2026-06-20

Task: Implement Phase 4 local Agent harness prototype.

Changed files:

- Added `src/lib/agent-harness.ts` with local Orchestrator run state, Agent steps, on-demand skill loading, quality gate summary, and Reviewer revision routing.
- Added `POST /api/runs` to create a run from a user topic.
- Added `GET /api/runs/[runId]` to read the current run snapshot.
- Updated `/workspace` so the ResearchFlow response box is driven by run API polling instead of frontend-only timers.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked `.next-webpack` cleanup with `EPERM`.
- Production server started at `http://localhost:3008`.
- `POST /api/runs` returned a running run.
- `GET /api/runs/[runId]` reached `completed` with progress `6/6` and returned `paper-blueprint.md`.
- `/workspace` and `/artifacts/tod-station-area/paper-blueprint.md` returned 200.

Issues:

- Phase 4 is implemented as a local deterministic prototype. It does not yet call a live LLM.
- Skill loading is local file loading from `/skills/*.md`; this is intentional for context control.
- Live paper search APIs remain Phase 5.

Next:

- Decide whether to connect the local Agent harness to an LLM API for Clarifier, Writer, Reviewer, and routing.
- Keep Semantic Scholar / Crossref integration for Phase 5 after the Agent harness behavior is stable.

## 2026-06-20

Task: Connect Phase 4 Agent harness to OpenAI API.

Changed files:

- Added `.env.local` template for `OPENAI_API_KEY`, `OPENAI_MODEL`, `SEMANTIC_SCHOLAR_API_KEY`, and `CROSSREF_MAILTO`.
- Updated `src/lib/agent-harness.ts` so each run step loads only its required local skill and calls the OpenAI Responses API server-side.
- Added retry handling for transient OpenAI/API edge errors including `429`, `500`, `502`, `503`, `504`, and `520`.
- Kept live paper search out of Phase 4; Research Agent still uses local seed materials until Phase 5.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked `.next-webpack` cleanup with `EPERM`.
- Production server started at `http://localhost:3011`.
- `POST /api/runs` created a run.
- `GET /api/runs/[runId]` reached `completed` with progress `6/6`.
- The completed run returned `Paper Blueprint ready` and a final `paper-blueprint.md` artifact card.
- `/workspace` and `/artifacts/tod-station-area/paper-blueprint.md` returned 200.

Issues:

- OpenAI returned transient `500` and Cloudflare `520` errors during early verification attempts. Retry handling was added and the full run later completed.
- Generated run artifacts are still in-memory summaries; persistent per-run artifact files remain future work.

Next:

- Decide whether Phase 4 should persist each LLM-generated internal artifact to disk under a run folder.
- Phase 5 should add Semantic Scholar / Crossref live paper search before replacing local seed paper materials.

## 2026-06-20

Task: Make Phase 4 runs intent-aware and preserve multi-turn chat history.

Changed files:

- Added `skills/conversation-response-skill.md` for follow-up questions and ordinary conversation.
- Updated `src/lib/agent-harness.ts` with `workflow` and `chat` run modes.
- Added simple Orchestrator intent classification so ordinary follow-ups do not restart the full paper-blueprint workflow.
- Updated `POST /api/runs` to accept recent conversation history.
- Updated `/workspace` so each user turn appends to the chat instead of replacing prior messages.
- Updated running status copy so it shows the active Agent/skill/output target rather than presenting every input as a fixed six-step run.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked `.next-webpack` cleanup with `EPERM`.
- Production server started at `http://localhost:3012`.
- A first-turn TOD research input entered workflow mode with progress `0/6`, active `Clarifier Agent`, and `scope-clarification-skill`.
- A follow-up question, `你对自己写的东西满意吗?`, with prior history completed as chat mode with progress `1/1` and no file artifact.
- `/workspace` returned 200.

Issues:

- Intent classification is currently heuristic. A later version can move classification into a small Orchestrator LLM call if needed.

Next:

- Test more follow-up cases in the browser.
- Persist per-run artifacts if Phase 4 needs durable files before Phase 5.

## 2026-06-20

Task: Upgrade intent-aware runs from workflow/chat split to Agent routing.

Changed files:

- Updated `src/lib/agent-harness.ts` so Orchestrator classifies user turns into `clarify`, `research`, `write`, `review`, `revise`, `status`, or `full_workflow`.
- Routed short turns to the relevant Agent rather than a generic response path:
  Clarifier for topic/scope discussion, Research for literature requests, Writer/Compiler for writing requests, Reviewer for quality/risk questions, and Orchestrator for status or revision routing.
- Kept full multi-Agent workflow only for explicit complete blueprint requests.
- Updated `/workspace` running copy to show the active Agent and target output without exposing implementation details such as context packing or local skill loading.
- Cleaned final result copy so user-facing output focuses on completed research work and final artifacts.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked `.next-webpack` cleanup with `EPERM`.
- Production server started at `http://localhost:3014`.
- UTF-8 API verification passed:
  `你觉得我这个主题怎么样?` routed to Clarifier with `1/1` step.
  `你对自己写的东西满意吗?` routed to Reviewer with `1/1` step.
  `请直接开始帮我生成完整论文框架` entered full workflow with `6` steps and started with Clarifier.
- `/workspace` returned 200.

Issues:

- Intent routing is still regex-based. It is adequate for prototype behavior, but can later become a lightweight Orchestrator LLM classification call.

Next:

- Browser-test more natural user turns and expand routing examples.
- Decide whether to add persistent per-run artifacts before Phase 5.

## 2026-06-21

Task: Finish Phase 4 by persisting per-run artifacts.

Changed files:

- Updated `src/lib/agent-harness.ts` so full workflow runs write generated artifacts under `sample-project/runs/<runId>/`.
- Internal JSON outputs are saved under `sample-project/runs/<runId>/internal/`.
- Final user-facing `paper-blueprint.md` is saved under `sample-project/runs/<runId>/paper-blueprint.md`.
- Updated the final artifact card to point to `/api/artifacts/<runId>/paper-blueprint.md`.
- Extended `src/app/api/artifacts/[projectId]/[file]/route.ts` to serve both the fixed demo artifact and run-specific `paper-blueprint.md` files.
- Added `sample-project/runs/` to `.gitignore`.

Validation:

- `npm run lint` passed.
- `npm run build` passed after running with required elevated permission because the sandbox blocked `.next-webpack` cleanup with `EPERM`.
- Production server started at `http://localhost:3016`.
- A full workflow run reached `completed` with progress `6/6`.
- The final artifact href was `/api/artifacts/run-mqnf9vce-o5awn/paper-blueprint.md`.
- The run-specific artifact route returned 200.
- The run folder contained `paper-blueprint.md` plus internal JSON files for research brief, paper pool, evidence pack, review notes, and revision log.

Issues:

- Phase 5 live paper search is not connected yet. Research still uses local seed materials before Semantic Scholar / Crossref integration.

Next:

- Start Phase 5 by adding a live paper search provider layer.
- First provider candidates: Semantic Scholar, Crossref, and optionally OpenAlex.

## 2026-06-23

Task: Upgrade Orchestrator from fixed step playback to a decision-loop controller.

Changed files:

- Updated `src/lib/agent-harness.ts` with an `OrchestratorDecision` union for `run_agent`, `call_tool`, and `final` decisions.
- Replaced the active run path with a bounded Orchestrator control loop:
  `orchestratorDecide(record) -> run tool / run Agent / finish`.
- Kept the previous linear executor as a deprecated backup while the new control loop becomes the active path.
- Added `targetStepCount` so dynamic runs can keep stable progress totals even though steps are now selected at runtime.
- Added `liveToolContexts` so Orchestrator can call live paper search first and Research Agent can reuse that tool result without duplicate API calls.
- Added per-decision event logs for Orchestrator decisions, tool calls, Agent steps, reasoning summaries, and session-memory writes.

Validation:

- `npx tsc --noEmit` passed.
- `npx eslint src/lib/agent-harness.ts` passed.

Issues:

- This is the first deterministic Orchestrator state machine. The decision policy is still code-driven rather than LLM-driven.
- User-interrupting `ask_user` decisions are not enabled yet; the current loop supports `run_agent`, `call_tool`, and `final`.

Next:

- Add `ask_user` support so Orchestrator can pause a run and request clarification.
- Move selected quality gates into explicit checks before Writer and Final decisions.
- Later, replace deterministic `orchestratorDecide(record)` rules with a small structured LLM decision call once the state contract is stable.

## 2026-06-23

Task: Add Orchestrator `ask_user` pause support and a Writer readiness quality gate.

Changed files:

- Extended `RunStatus` with `waiting_for_user` so a run can pause instead of failing or continuing with weak context.
- Added `requiresUserInput` and `question` to run snapshots so the UI can display an Orchestrator clarification prompt.
- Added an `ask_user` branch to `OrchestratorDecision`.
- Added `pauseForUser()` to stop the control loop, save the clarification question to session memory, and record decision events.
- Added `evaluateWriterGate()` before `Writer/Compiler Agent` runs.
- The Writer gate now blocks drafting when live literature search failed, the paper pool/evidence pack is too thin, or scope still needs user confirmation.
- Updated `/workspace` so `waiting_for_user` stops polling, clears running state, and shows the Orchestrator question as the current response.

Validation:

- `npx tsc --noEmit` passed.
- `npx eslint src/lib/agent-harness.ts src/components/workspace-chat.tsx` passed.

Issues:

- `ask_user` currently pauses the current run; the next user reply starts a new run in the same session with saved history. A later version can add explicit run resume by `runId`.
- Writer gate checks are deterministic heuristics. They should later be backed by structured quality-gate artifacts or a small Orchestrator LLM decision.

Next:

- Add explicit `resumeRun(runId, answer)` support if we want one continuous run ID across clarification turns.
- Add quality gates before `final`, especially checking Reviewer blocking issues and blueprint completeness.

## 2026-06-23

Task: Complete run resume, final quality gate, structured gates, and UTF-8 cleanup.

Changed files:

- Added `POST /api/runs/[runId]/resume` so user clarification can continue the same paused run instead of creating a new run.
- Added `resumeRun(runId, answer)` in `src/lib/agent-harness.ts`; it appends the user answer to history, records the clarification, clears the pending question, and restarts the Orchestrator loop.
- Updated `/workspace` to store `pendingRunId`; when the user answers an Orchestrator question, the UI calls the resume endpoint and continues polling the same run.
- Added a structured `QualityGateResult` contract with severity, issues, next action, question, and reason.
- Reworked the Writer gate to return structured gate results and to continue after user clarification.
- Added a Final gate that checks blueprint length, review notes, revision routing, core blueprint sections, and blocking review signals before final completion.
- Rewrote `src/lib/agent-harness.ts` and `src/components/workspace-chat.tsx` with clean UTF-8 Chinese copy, removing historical mojibake from active code paths.
- Removed the deprecated linear executor; the active path is now the Orchestrator decision loop only.

Validation:

- `npx tsc --noEmit` passed.
- `npx eslint src/lib/agent-harness.ts src/components/workspace-chat.tsx src/app/api/runs/[runId]/resume/route.ts` passed.

Issues:

- Resume works for in-memory runs. A server restart will still lose paused run state until run records are persisted.
- Final gate is deterministic and heuristic; it should later be backed by structured Reviewer output.

Next:

- Persist active run state to disk or a database so `waiting_for_user` runs survive server restarts.
- Convert Reviewer and revision-routing artifacts into strict schemas so quality gates can check fields instead of text patterns.

## 2026-06-23

Task: Start Phase 5 live paper search hardening without requiring a Semantic Scholar API key.

Changed files:

- Updated `docs/RESUME_BRIEF.md` so it reflects the current Orchestrator decision-loop, `ask_user`/resume support, structured gates, Crossref mailto setup, and Phase 5 priorities.
- Reworked `src/lib/research-tools.ts` to add source labels, quality scores, result filtering, duplicate merging, provider failure traces, and a structured live search quality summary.
- Updated `src/lib/agent-harness.ts` so Orchestrator stores live search quality, passes fallback instructions into Research Agent context, and records live search quality issues in run events.
- Updated Writer readiness gate so it checks live search quality rather than only checking whether a provider completed.

Validation:

- `npx tsc --noEmit` passed.
- `npx eslint src/lib/research-tools.ts` passed.
- `npx eslint src/lib/agent-harness.ts` passed.

Issues:

- `SEMANTIC_SCHOLAR_API_KEY` is still optional and not configured. The code can continue with unauthenticated Semantic Scholar requests, but rate limits may be tighter.
- Live API behavior still needs runtime verification because the local environment may restrict network access.

Next:

- Run a full `/workspace` workflow with live search enabled.
- Persist active run state so paused runs survive server restarts.
- Convert Reviewer and revision-routing artifacts into stricter schemas for final quality gates.
