# PRODUCT_SPEC

## Pages

### `/workspace`

The first screen is a chat-first workspace, not a marketing page and not a dashboard board.

Show:

- Left sidebar with new chat, new project, recent projects, and discovery entries.
- Center chat stream as the primary interaction surface.
- Bottom composer for user research requests.
- Agent execution as messages in the stream.
- Orchestrator decisions, skill loading, and handoff summaries inside the message flow.
- Final file card for `paper-blueprint.md`.

Do not spread the workflow across many simultaneous panels. The user should experience Agent work as a conversation.

### `/projects/[id]`

Show:

- Project overview.
- Current phase and status.
- One primary artifact: `paper-blueprint.md`.
- Internal process summary.
- Reviewer revision summary.
- Quality gate status.

Do not present intermediate Agent files as the main user-facing output.

## Demo Project

Default project:

`TOD 模式下城市轨道交通站点周边土地利用与出行行为论文框架`

Slug:

`tod-station-area`

## User-Facing Behavior

The demo should feel like watching a research workflow run:

1. User enters a vague topic.
2. Clarifier narrows scope.
3. Orchestrator selects Research Agent and skills.
4. Research Agent creates internal evidence materials.
5. Writer/Compiler creates `paper-blueprint.md`.
6. Reviewer raises classified challenges.
7. Orchestrator routes revision.
8. Writer/Compiler updates the final blueprint.
9. Orchestrator marks the blueprint ready.

## Display Rules

- Prefer chat messages, short execution summaries, and one final file card.
- Show process transparency without raw prompts.
- Show skill names because skills are a product feature.
- Keep internal files visible as process evidence, not as primary downloads.
