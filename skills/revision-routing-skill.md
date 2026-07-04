# revision-routing-skill

## Applicable Agent

Orchestrator Agent.

## Trigger

Use when Reviewer issues need routing or when deciding whether the paper blueprint is ready.

## Input

- Review notes.
- Current workflow state.
- Artifact summaries.

## Output

- Internal `revision-log.json`.
- Quality gate decision.

## Routing Rules

- `scope_issue` -> Clarifier Agent.
- `evidence_issue` -> Research Agent.
- `gap_issue` -> Research Agent if new evidence is needed, otherwise Writer/Compiler Agent.
- `method_issue` -> Writer/Compiler Agent unless evidence is missing.
- `writing_issue` -> Writer/Compiler Agent.
- `citation_issue` -> Research Agent if metadata is missing, otherwise Writer/Compiler Agent.
- `data_issue` -> Clarifier Agent if scope/data assumptions are unclear, otherwise Writer/Compiler Agent for method revision.

## Required Fields

Return JSON-ready routing notes with:

- `decision`: ready, revise, ask_user, or defer_with_warning.
- `routed_items`: issue ID, target agent, target skill, artifact to change, and reason.
- `quality_gate`: passed or failed with criteria.
- `deferred_risks`: risks kept visible in final output.
- `change_summary`: what changed or should change.
- `next_action`: final output, ask user, rerun search, revise blueprint, or stop.

## Quality Gate

Final output is allowed only when:

- No critical scope, evidence, citation, data, or method issue is unresolved.
- Remaining risks are explicitly visible in the blueprint.
- The blueprint does not claim literature exhaustion.
- Source-grounded claims can be traced to the paper pool or evidence pack.

## Quality Checks

- The routed Agent matches the issue type.
- The loaded skill is recorded.
- The changed artifact and change summary are recorded.
- Final output is allowed only after unresolved critical issues are handled or explicitly deferred.
