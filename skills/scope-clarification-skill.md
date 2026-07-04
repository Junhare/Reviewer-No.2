# scope-clarification-skill

## Applicable Agent

Clarifier Agent.

## Trigger

Use when the user topic is broad, ambiguous, mixes multiple research outcomes, or lacks a concrete empirical boundary.

## Input

- User topic and recent conversation.
- Known constraints such as discipline, city/case, available data, target output, language, and deadline.
- Any previous research brief or reviewer concerns.

## Output

Internal `research-brief.json`.

## Required Fields

Return a JSON-ready brief with:

- `working_title`: narrow, paper-sized title.
- `research_object`: unit of analysis, population, place, or case.
- `scope`: spatial, temporal, disciplinary, and empirical boundaries.
- `core_question`: one main research question.
- `sub_questions`: 2-4 supporting questions.
- `keywords`: English search keywords and 2-4 synonyms.
- `inclusion_criteria`: what papers or evidence count.
- `exclusion_criteria`: what is explicitly out of scope.
- `data_assumptions`: likely data sources and missing data risks.
- `method_candidates`: 1-3 plausible methods with constraints.
- `clarification_needed`: only blocking questions, max 3.

## Workflow

1. Convert the user's broad topic into 2-3 possible paper-sized framings.
2. Choose the most feasible framing unless the user has clearly chosen another.
3. Make every boundary explicit enough to drive a literature search.
4. Separate what is known from what is assumed.
5. If the scope is still too broad, ask one focused clarification question instead of producing a confident brief.

## Prohibited Behavior

- Do not search papers.
- Do not write the final paper blueprint.
- Do not expand the topic beyond the user's domain.
- Do not invent data availability.

## Quality Checks

- Scope is narrow enough for one paper.
- Keywords can drive OpenAlex, Semantic Scholar, and Crossref searches.
- Exclusions are explicit.
- The brief can be used by Research Agent without reading the full chat history.
