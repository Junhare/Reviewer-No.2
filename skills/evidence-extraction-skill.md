# evidence-extraction-skill

## Applicable Agent

Research Agent.

## Trigger

Use after candidate papers are selected and the system needs structured evidence.

## Input

- Paper pool.
- Research brief.
- Available abstracts, titles, metadata, citation counts, and provider notes.

## Output

Internal `evidence-pack.json`.

## Required Fields

Return a JSON-ready evidence pack with:

- `evidence_items`: one item per usable paper or clustered finding.
- `methods`: methods used in the papers, separated from findings.
- `variables`: dependent, independent, control, mediator, moderator, and spatial variables when available.
- `findings`: claims grounded only in available metadata or abstracts.
- `limitations`: limitations stated by sources or inferred from missing data, clearly labeled.
- `evidence_strength`: high, medium, low, or unknown with reason.
- `citation_map`: map claims to paper IDs, DOI, or URLs.
- `unverified_claims`: claims that need full-text checking.

## Extraction Rules

1. Extract only what the source metadata or abstract supports.
2. Separate descriptive facts, empirical findings, theoretical mechanisms, and methodological choices.
3. Prefer cautious phrasing when only title or metadata is available.
4. Track negative space: what the paper pool does not cover.
5. Preserve source links so Writer/Compiler can cite responsibly.

## Prohibited Behavior

- Do not write prose claims that are not grounded in paper metadata or abstracts.
- Do not turn extraction into a literature review draft.
- Do not promote a weak or single-paper observation into a field-level conclusion.

## Quality Checks

- Methods, variables, findings, limitations, and evidence needs are separated.
- Every substantive claim has a source pointer.
- Uncertain claims are marked as limitations or evidence needs.
- The pack is usable by Writer/Compiler without full conversation context.
