# API: By-Prompt Reporting

`GET /api/projects/:projectId/by-prompt`

## Query params
- `from` (required): `YYYY-MM-DD`
- `to` (required): `YYYY-MM-DD`
- `tagIds` (optional): comma-separated tag ids (`tag_1,tag_2`)
- `country` (optional): ISO-3166 alpha-2 (example: `US`)
- `language` (optional): language code (example: `en`, `es-mx`)
- `sortBy` (optional): `executions | validResponses | mentionRate | citationRate | competitorPresence`
- `sortDir` (optional): `asc | desc` (default: `desc`)

## Response shape
- `prompts[]` includes one row per prompt with all fields needed for prompts table and exports:
  - executions
  - validResponses
  - mentionRate
  - citationRate
  - topCitedDomains
  - topModels
  - competitorPresence
  - sentimentSummary
  - deltaVsPrevious

This payload is designed to be consumed directly by the Prompts page and export generators without additional server joins.
