# AGENT_CONTRACTS

## Shared Rules

- Each Agent receives only the current task input, relevant artifact summaries, and required skill instructions.
- Each Agent returns structured output and a short human-readable summary.
- No Agent may invent paper sources.
- No Agent may silently change another Agent's responsibility.
- Intermediate outputs are internal materials; the user-facing deliverable is `paper-blueprint.md`.

## Orchestrator Agent

Owns:

- Stage control.
- Agent routing.
- Skill selection.
- Revision routing.
- Quality gate decision.
- Decision logging.

Does not own:

- Writing `paper-blueprint.md`.
- Searching or extracting literature.
- Reviewer critique.

Required output:

- Called Agent.
- Reason for call.
- Loaded skill.
- Handoff summary.
- Quality gate status.
- Artifact change summary.

## Clarifier Agent

Owns:

- Guided questions.
- Scope narrowing.
- Research boundaries.
- Exclusion criteria.

Outputs:

- Internal `research-brief.json`.

Does not own:

- Literature search.
- Final paper blueprint writing.

## Research Agent

Owns:

- Literature search.
- Metadata collection.
- Structured extraction.
- Evidence pack creation.
- Evidence-grounded gap candidates.

Outputs:

- Internal `paper-pool.json`.
- Internal `evidence-pack.json`.
- Internal `gap-analysis.json` when evidence needs analysis.

Does not own:

- Final paper blueprint writing.
- Unsupported narrative claims.

## Writer/Compiler Agent

Owns:

- Turning structured inputs into `paper-blueprint.md`.
- Writing the paper framework, not the full manuscript.
- Revising the blueprint after Reviewer feedback.
- Reflecting risks and next writing tasks.

Outputs:

- User-facing `paper-blueprint.md`.

Does not own:

- Searching for new evidence unless Orchestrator routes the work back through Research Agent.

## Reviewer Agent

Owns:

- Critique.
- Risk detection.
- Counter-questions.
- Revision issue classification.

Outputs:

- Internal `review-notes.json`.

Issue types:

- `scope_issue`
- `evidence_issue`
- `gap_issue`
- `method_issue`
- `writing_issue`

Does not own:

- Direct artifact editing.
