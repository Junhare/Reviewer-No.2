# PROJECT_CHARTER

## Product

ResearchFlow Agent is a research project management workspace that helps graduate researchers turn a vague research idea into a detailed paper blueprint.

## Positioning

The product is a general research planning tool, not a TOD-only tool. TOD / urban rail station-area research is the default demo topic because the owner can better evaluate the output and explain the domain logic.

## Target Users

- Graduate students and PhD students starting a new research direction.
- Users who have a topic area but lack a structured literature map, research boundary, critique loop, and paper outline.

## Core Pain

Early-stage research work is fragmented across literature search, reading notes, research question narrowing, critique, and writing preparation. Users often collect papers before they know how the final paper should be structured.

## Final User Deliverable

The user-facing deliverable is:

- `paper-blueprint.md`

This is a detailed paper framework, not a full manuscript. It includes the tentative title, abstract structure, introduction logic, literature review structure, research questions, analytical framework, data and variable design, method route, expected contribution, Reviewer challenges, and next writing tasks.

## Internal Agent Materials

Intermediate outputs are kept as internal files:

- `internal/research-brief.json`
- `internal/paper-pool.json`
- `internal/evidence-pack.json`
- `internal/gap-analysis.json`
- `internal/review-notes.json`
- `internal/revision-log.json`

They support Agent handoff, Orchestrator quality gates, Reviewer routing, and traceability. They are not the main user download.

## Non-Goals

- No complete paper generation in v1.
- No account system in v1.
- No PDF full-text parsing in v1.
- No automatic claim without source links.
- No hidden all-in-one agent that writes everything.

## Success Criteria

- A visitor can understand which Agent did what and why.
- The user sees one clear final deliverable.
- Research Agent behaves like an evidence worker, not a writer.
- Writer/Compiler writes from structured inputs only.
- Reviewer triggers classified revision requests.
- Orchestrator records routing decisions and decides when the blueprint is ready.
