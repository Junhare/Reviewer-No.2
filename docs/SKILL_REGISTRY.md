# SKILL_REGISTRY

Skills are loaded only when needed. They are not permanent Agent memory and they are not separate Agents.

## What A Skill Is

A skill is a task-specific instruction module containing:

- Applicable Agent.
- Trigger condition.
- Input format.
- Output format.
- Prohibited behavior.
- Quality checks.
- Example output.

## scope-clarification-skill

Used by:

- Clarifier Agent

Trigger:

- User topic is broad, ambiguous, or lacks research boundary.

Output:

- Internal `research-brief.json`.

## paper-search-skill

Used by:

- Research Agent

Trigger:

- Need real paper candidates.

Output:

- Internal `paper-pool.json`.

## evidence-extraction-skill

Used by:

- Research Agent

Trigger:

- Paper metadata or abstracts need structured extraction.

Output:

- Internal `evidence-pack.json`.

## gap-analysis-skill

Used by:

- Research Agent
- Writer/Compiler Agent

Trigger:

- Evidence pack is available and the system needs a defensible paper gap.

Output:

- Internal `gap-analysis.json`.

## paper-blueprint-writing-skill

Used by:

- Writer/Compiler Agent

Trigger:

- Structured research brief, evidence pack, and gap analysis are ready.

Output:

- User-facing `paper-blueprint.md`.

## review-challenge-skill

Used by:

- Reviewer Agent

Trigger:

- A paper blueprint draft needs critique.

Output:

- Internal `review-notes.json`.

## revision-routing-skill

Used by:

- Orchestrator Agent

Trigger:

- Reviewer issues need to be routed to the right Agent.

Output:

- Internal `revision-log.json`.
- Quality gate decision.
