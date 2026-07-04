# WORKFLOW_RULES

## Main Flow

1. Orchestrator starts with user topic.
2. Orchestrator calls Clarifier with `scope-clarification-skill`.
3. Clarifier writes internal `research-brief.json`.
4. Orchestrator calls Research Agent with `paper-search-skill`.
5. Research Agent writes internal `paper-pool.json`.
6. Orchestrator calls Research Agent with `evidence-extraction-skill`.
7. Research Agent writes internal `evidence-pack.json`.
8. Orchestrator calls Research Agent and Writer/Compiler with `gap-analysis-skill`.
9. Writer/Compiler uses `paper-blueprint-writing-skill` to create `paper-blueprint.md`.
10. Orchestrator calls Reviewer with `review-challenge-skill`.
11. Reviewer writes internal `review-notes.json`.
12. Orchestrator uses `revision-routing-skill` to route revisions.
13. Writer/Compiler revises `paper-blueprint.md`.
14. Orchestrator decides whether `Paper Blueprint ready`.

## Revision Routing

- `scope_issue` -> Clarifier Agent
- `evidence_issue` -> Research Agent
- `gap_issue` -> Research Agent or Writer/Compiler depending on whether new evidence is required
- `method_issue` -> Writer/Compiler Agent, unless new evidence is needed
- `writing_issue` -> Writer/Compiler Agent

## Quality Gate Before Final Output

Orchestrator may mark `paper-blueprint.md` ready only when:

- Scope is narrow enough for a paper.
- Key claims are grounded in linked sources or marked as hypotheses.
- Research Agent has provided evidence rather than narrative prose.
- Reviewer issues have been routed or explicitly deferred.
- Writer/Compiler has revised the blueprint after review.
- The output is a paper framework, not a full manuscript.

## Revision Log Requirements

Each revision record must include:

- Date or run id.
- Reviewer issue.
- Why it was returned.
- Returned to which Agent.
- Loaded skill.
- Changed artifact.
- Change summary.

## Visibility Rules

Show:

- Agent name.
- Skill name.
- Decision reason.
- Handoff summary.
- Quality gate status.
- Final `paper-blueprint.md` link.

Hide:

- Full prompt.
- Long raw model output.
- Complete internal JSON content in the timeline.
