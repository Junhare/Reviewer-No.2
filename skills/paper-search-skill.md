# paper-search-skill

## Applicable Agent

Research Agent.

## Trigger

Use when the system needs source-linked candidate papers or a refreshed paper pool.

## Input

- Internal research brief.
- Live tool context from OpenAlex, Semantic Scholar, and Crossref.
- Keywords, inclusion rules, exclusion rules, and evidence needs.

## Output

Internal `paper-pool.json`.

## Required Fields

Return a JSON-ready paper pool with:

- `query_strategy`: keyword combinations and why they were used.
- `provider_summary`: completed, skipped, and failed providers.
- `papers`: each paper should include title, year, authors, venue, DOI or URL, provider sources, citation count when available, abstract status, selection reason, and relevance notes.
- `rejected_candidates`: optional short list with rejection reason.
- `coverage_gaps`: missing subtopics, weak provider coverage, or fields that require manual verification.
- `recommended_next_queries`: 3-6 follow-up queries.

## Source Priority

- OpenAlex is the primary discovery source for broad academic coverage, citation counts, venues, and author/source metadata.
- Semantic Scholar is useful for abstracts, AI/CS coverage, citation metadata, and paper graph signals.
- Crossref is used for DOI, publication metadata, journal/source checks, and title/date validation.

## Selection Rules

1. Prefer papers inside the research boundary over highly cited but off-topic papers.
2. Prioritize papers with DOI or stable URL.
3. Prefer papers with abstracts when evidence extraction is next.
4. Keep a balanced pool: foundational papers, recent papers, methods papers, and directly related empirical studies.
5. Deduplicate by DOI first, then paper ID, then normalized title.
6. Mark thin evidence honestly; do not treat search results as an exhaustive systematic review.

## Prohibited Behavior

- Do not invent papers, authors, journals, DOI values, citation counts, or abstracts.
- Do not cite a paper without a source URL, DOI, or provider ID.
- Do not write the final paper blueprint.
- Do not hide failed or skipped providers.

## Quality Checks

- Every included paper has a source URL, DOI, or provider ID.
- Included papers match the research boundary.
- Selection reason is explicit.
- Provider limitations are visible to Writer/Compiler and Reviewer.
