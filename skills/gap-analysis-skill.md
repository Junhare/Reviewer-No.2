# gap-analysis-skill

## Applicable Agents

Research Agent and Writer/Compiler Agent.

## Trigger

Use when an evidence pack exists and the system needs a defensible paper gap.

## Input

- Research brief.
- Evidence pack.
- Paper pool.
- User constraints and target discipline.

## Output

Internal `gap-analysis.json`.

## Required Fields

Return a JSON-ready gap analysis with:

- `candidate_gaps`: 2-4 possible gaps, each with evidence basis and risk.
- `selected_gap`: the best gap for this user's project.
- `gap_type`: empirical, methodological, contextual, theoretical, data, measurement, or synthesis.
- `why_defensible`: why the gap follows from the current evidence.
- `why_feasible`: why it can become a paper question with likely data/methods.
- `research_questions`: one main question plus 2-4 subquestions.
- `hypotheses_or_propositions`: only when justified.
- `evidence_needed`: what still needs full-text review or more search.
- `risk_flags`: overclaiming, missing literature, data availability, identification, or scope risks.

## Gap Selection Rules

1. Do not claim a field-wide gap from a small paper pool.
2. Prefer a narrow, testable gap over a broad novelty claim.
3. Connect each gap to variables, method, and data assumptions.
4. Distinguish "not found in current search" from "absent in the literature."
5. If evidence is weak, frame the output as a candidate gap and request more search.

## Prohibited Behavior

- Do not claim a gap is proven from a tiny paper pool.
- Do not choose a gap that cannot become a paper question.
- Do not claim novelty without evidence.
- Do not ignore Reviewer risk flags.

## Quality Checks

- Selected gap is narrower than the initial topic.
- Evidence needs are explicit.
- Gap can map to research questions and variables.
- Residual uncertainty is visible.
