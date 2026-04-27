# API: Project Summary Reporting

## Endpoint

`GET /api/projects/:projectId/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns report-ready top-level metrics for the selected project and date range.

## Query params

- `from` (required): start day (UTC) in `YYYY-MM-DD`.
- `to` (required): end day (UTC) in `YYYY-MM-DD`.
- `useSnapshots` (optional): set to `1` to prefer daily KPI snapshots when they are complete and valid for the range.

Validation rules:

- both params are required.
- `from` must be before or equal to `to`.
- max range is 365 days.

## Success response (`200`)

```json
{
  "projectId": "proj_123",
  "range": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-07T23:59:59.999Z"
  },
  "previousComparableRange": {
    "from": "2026-03-25T00:00:00.000Z",
    "to": "2026-03-31T23:59:59.999Z"
  },
  "summary": {
    "totalPrompts": 12,
    "promptsExecuted": 9,
    "validResponses": 86,
    "mentionRate": { "value": 0.63, "numerator": 54, "denominator": 86 },
    "citationRate": { "value": 0.78, "numerator": 67, "denominator": 86 },
    "shareOfVoice": { "value": 0.57, "ownBrandMentions": 190, "totalTrackedMentions": 332 },
    "sourceShare": {
      "totalCitations": 211,
      "byDomain": [
        { "domain": "example.com", "citations": 48, "share": 0.227 },
        { "domain": "news.site", "citations": 30, "share": 0.142 }
      ]
    },
    "sentimentDistribution": {
      "denominator": 86,
      "buckets": {
        "positive": { "count": 41, "share": 0.476 },
        "neutral": { "count": 30, "share": 0.348 },
        "negative": { "count": 11, "share": 0.127 },
        "other": { "count": 4, "share": 0.046 }
      }
    },
    "topCitedDomains": [
      { "domain": "example.com", "citations": 48, "share": 0.227 }
    ],
    "strongestPrompts": [
      {
        "promptId": "pr_1",
        "promptTitle": "Best EV news sources",
        "validResponseCount": 9,
        "mentionRate": 0.88,
        "mentionRateNumerator": 8,
        "mentionRateDenominator": 9,
        "runCount": 11
      }
    ],
    "weakestPrompts": [
      {
        "promptId": "pr_8",
        "promptTitle": "How to choose an insurer",
        "validResponseCount": 7,
        "mentionRate": 0.14,
        "mentionRateNumerator": 1,
        "mentionRateDenominator": 7,
        "runCount": 8
      }
    ]
  },
  "deltaVsPrevious": {
    "totalPrompts": { "current": 12, "previous": 11, "absolute": 1, "relative": 0.0909 },
    "promptsExecuted": { "current": 9, "previous": 7, "absolute": 2, "relative": 0.2857 },
    "validResponses": { "current": 86, "previous": 70, "absolute": 16, "relative": 0.2285 },
    "mentionRate": { "current": 0.63, "previous": 0.55, "absolute": 0.08, "relative": 0.1454 },
    "citationRate": { "current": 0.78, "previous": 0.72, "absolute": 0.06, "relative": 0.0833 },
    "shareOfVoice": { "current": 0.57, "previous": 0.52, "absolute": 0.05, "relative": 0.0961 }
  },
  "generatedAt": "2026-04-08T13:20:31.190Z"
}
```

## Error response (`400`)

```json
{
  "error": "invalid_date_range",
  "details": {
    "from": "from is required in YYYY-MM-DD format.",
    "to": "to is required in YYYY-MM-DD format."
  }
}
```

## Example request

```bash
curl "http://localhost:3000/api/projects/proj_123/summary?from=2026-04-01&to=2026-04-07" \
  -H "Cookie: ai_visibility_session=..."
```


## KPI snapshot regeneration job

`POST /api/projects/:projectId/kpi-snapshots/regenerate?from=YYYY-MM-DD&to=YYYY-MM-DD`

Generates (or replaces) project-level daily snapshots (`granularity=DAY`) for each day in the range. Snapshot payloads are computed with the same KPI formulas used by direct reporting (`computeKpis`) so they never become a second source of truth.

### Invalidation strategy

When `useSnapshots=1`, summary reads snapshots only if all checks pass:

1. there is exactly one daily project snapshot for each day in the requested range;
2. all snapshots use schema version `1` and a full-day UTC period;
3. no source mutation in the range is newer than the snapshot set (latest mutation from `run.updatedAt`, `response.updatedAt`, `citation.createdAt`, `response_brand_mention.createdAt`).

If any check fails, the endpoint transparently falls back to direct calculation from source tables.
