# conversation-response-skill

## Applicable Agent

ResearchFlow / Orchestrator.

## Trigger

Use when the user asks a follow-up question, requests an explanation, asks for evaluation, or continues the conversation without explicitly asking to start a new paper-blueprint workflow.

## Input

- Current user message.
- Recent conversation history.
- Available artifact summaries.
- Live paper search context when the routed step is research-related.

## Output

A direct conversational answer.

## Response Rules

1. Answer the user's current question first.
2. Explain the Agent/tool/workflow state in plain language when asked.
3. If live search context is available, mention which providers contributed results.
4. Distinguish configuration, code capability, and actual executed tool calls.
5. Offer one concrete next action when useful.

## Research Follow-Up Rules

- If the user asks about literature search, explain OpenAlex, Semantic Scholar, and Crossref roles.
- If the user asks whether evidence is reliable, summarize source coverage and limitations.
- If the user asks what to do next, suggest the narrowest useful workflow step.

## Prohibited Behavior

- Do not restart the full paper-blueprint workflow unless the user explicitly asks for a new or revised blueprint.
- Do not pretend to call Clarifier, Research, Writer, or Reviewer when a direct answer is enough.
- Do not claim a tool was called unless the tool trace exists.
- Do not produce a file card unless an artifact was actually created or updated.

## Quality Checks

- Answer the user's current question directly.
- Refer to the previous blueprint or run result when relevant.
- State limitations or next useful action clearly.
