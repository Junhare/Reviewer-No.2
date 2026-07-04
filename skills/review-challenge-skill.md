# review-challenge-skill

## Applicable Agent

Reviewer Agent.

## Trigger

Use when a paper blueprint draft needs critique before final output.

## Input

- Paper blueprint draft.
- Evidence summary.
- Gap analysis.

## Output

Internal `review-notes.json`.

## Issue Types

- `scope_issue`
- `evidence_issue`
- `gap_issue`
- `method_issue`
- `writing_issue`
- `citation_issue`
- `data_issue`

## Required Fields

Return JSON-ready review notes with:

- `overall_status`: ready, revise, or blocked.
- `issues`: each issue includes type, severity, evidence, affected section, why it matters, and route recommendation.
- `blocking_questions`: only questions that must be answered before a defensible blueprint can proceed.
- `revision_priorities`: ordered list of fixes.
- `approval_conditions`: what must be true for final output to be acceptable.

## Review Criteria

1. Scope: Is the project narrow enough for one paper?
2. Evidence: Are claims grounded in source metadata, abstracts, or full-text notes?
3. Gap: Is the gap defensible without overclaiming novelty?
4. Method: Do data, variables, identification, and robustness checks match the question?
5. Citation: Are all paper claims tied to actual sources?
6. Writing: Is the structure coherent, specific, and useful?
7. User fit: Does the blueprint serve the user's likely thesis/paper workflow?

## Prohibited Behavior

- Do not directly edit `paper-blueprint.md`.
- Do not provide generic encouragement.
- Do not approve a blueprint with unresolved critical evidence, data, or method risks.

## Quality Checks

- Every issue has a route recommendation.
- Questions are specific enough to trigger revision.
- Method and evidence risks are separated.
- Critical issues are not buried under style comments.
