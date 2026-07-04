# ARTIFACT_SCHEMA

## User-Facing Artifact

### paper-blueprint.md

Required sections:

- Tentative paper title.
- Abstract draft structure.
- Research background and problem logic.
- Literature review structure.
- Core research questions.
- Theoretical or analytical framework.
- Data and variable design.
- Method route.
- Expected contribution.
- Risks and Reviewer challenges.
- Next writing tasks.

This file is the main user output.

## Internal Artifacts

### internal/research-brief.json

Required fields:

- `topic`
- `objective`
- `scope`
- `keywords`
- `exclusions`
- `successCriteria`

### internal/paper-pool.json

Required fields:

- `selectionCriteria`
- `papers[]`
- `papers[].title`
- `papers[].year`
- `papers[].sourceUrl`
- `papers[].reason`

### internal/evidence-pack.json

Required fields:

- `projectId`
- `evidenceSummary.methods`
- `evidenceSummary.variables`
- `evidenceSummary.findings`
- `evidenceSummary.limitations`

### internal/gap-analysis.json

Required fields:

- `selectedGap`
- `candidateGaps`
- `whySelected`
- `evidenceNeeds`

### internal/review-notes.json

Required fields:

- `issues[]`
- `issues[].type`
- `issues[].question`
- `issues[].route`

### internal/revision-log.json

Required fields:

- `revisions[]`
- `revisions[].issueType`
- `revisions[].returnedTo`
- `revisions[].skill`
- `revisions[].changedArtifact`
- `revisions[].changeSummary`
