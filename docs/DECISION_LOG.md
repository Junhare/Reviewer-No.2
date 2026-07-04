# DECISION_LOG

## 2026-06-15

Decision: Use TOD / urban rail station-area research as the default sample topic.

Reason: The project owner can better evaluate output quality and explain domain logic in AIPM interviews.

Rejected alternative: AI / large-model research as default sample topic.

Impact: Product positioning remains general, but sample content is transportation research.

## 2026-06-19

Decision: Replace the multi-file user-facing kickoff package with one main user artifact, `paper-blueprint.md`.

Reason: The previous file list showed process well but made the user-facing value feel scattered. A detailed paper blueprint is easier to understand, use, and explain in AIPM interviews.

Rejected alternative: Keep every Agent output as a main downloadable file.

Impact: Intermediate files move under `sample-project/internal` and become process materials rather than primary user output.

## 2026-06-19

Decision: Refactor `/workspace` from a dashboard-style panel layout to a chat-first Agent workspace.

Reason: Users expect Agent products to behave more like Codex or ChatGPT: a central conversation, a left project/history sidebar, bottom input, and Agent execution steps streamed as messages.

Rejected alternative: Keep separate fixed panels for guided conversation, timeline, files, and quality gates.

Impact: `/workspace` now uses a sidebar + central chat stream + composer layout. Agent steps are shown as sequential messages ending with a `paper-blueprint.md` file card.

## 2026-06-19

Decision: Present the Agent workflow as Orchestrator-driven quality gates rather than a fixed linear chain.

Reason: A realistic multi-Agent product should let Orchestrator inspect each Agent's output, decide whether the result passes, and route Reviewer issues back to the responsible Agent.

Rejected alternative: Always run Clarifier -> Research -> Writer/Compiler -> Reviewer as a hard-coded one-way sequence.

Impact: `/workspace` now shows Orchestrator checkpoints between Agent steps, including scope/evidence gates and revision routing such as `gap_issue -> Research Agent` and `method_issue -> Writer/Compiler Agent`.

## 2026-06-15

Decision: Use file artifacts as the primary output surface.

Reason: This mirrors agent workspaces like Codex, keeps pages readable, and avoids turning the UI into a long report viewer.

Rejected alternative: Render complete paper pool, plan, and review text inline.

Impact: `/workspace` and `/projects/[id]` show summaries plus links.

## 2026-06-15

Decision: Implement v1 as a static sample-driven Next.js demo.

Reason: It proves the product workflow before adding LLM/API cost and instability.

Rejected alternative: Start with live Agent calls.

Impact: Agent harness and API integration remain future phases.

## 2026-06-23

Decision: Upgrade Orchestrator from a prebuilt step list to a runtime decision loop.

Reason: A believable research Agent manager must inspect current state, decide whether to call tools, route work to an Agent, or finish, and log each decision. A fixed `buildSteps(intent)` list cannot react to missing evidence, tool results, or quality-gate state.

Rejected alternative: Keep the fixed Clarifier -> Research -> Evidence -> Writer -> Reviewer -> Revision sequence and only improve UI copy.

Impact: Runs now enter a bounded `orchestratorDecide(record)` loop. Steps are selected at runtime, live paper search is called as an Orchestrator tool decision, and each decision is recorded as a run event for UI traceability.

## 2026-06-23

Decision: Let Orchestrator pause for user clarification before weak drafting.

Reason: A real project manager should not continue into writing when scope is ambiguous or evidence is too thin. Pausing with a concrete question creates a better interaction than generating a low-confidence blueprint.

Rejected alternative: Always continue to Writer after evidence extraction as long as an `evidence-pack.json` file exists.

Impact: The run model now supports `waiting_for_user`; the UI can show Orchestrator's question, and Writer is protected by a readiness gate covering live literature search, evidence depth, and scope confirmation.

## 2026-06-23

Decision: Resume paused work by `runId` instead of treating clarification as a new task.

Reason: A user answer to an Orchestrator clarification belongs to the same research run. Keeping the same `runId` preserves artifacts, tool traces, quality-gate state, and decision logs.

Rejected alternative: Continue using only session memory and start a new run after every clarification answer.

Impact: The app now has a resume endpoint and frontend pending-run handling. Paused runs can continue from their existing state after the user answers.

## 2026-06-23

Decision: Use structured quality-gate results for Writer and Final gates.

Reason: Gates need more than a boolean. Severity, issues, next action, and user-facing question make Orchestrator decisions explainable and easier to show in the UI.

Rejected alternative: Keep ad hoc boolean checks embedded directly in `orchestratorDecide`.

Impact: Writer readiness and Final readiness now return a shared `QualityGateResult` shape, making future UI and schema-backed checks easier.
