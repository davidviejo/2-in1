# API: Project KPI Timeseries

## Endpoint

`GET /api/projects/:projectId/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week`

Returns chart-ready KPI timeseries data with UTC-stable boundaries and zero-filled gaps.

## Query params

- `from` (required): start day (UTC) in `YYYY-MM-DD`.
- `to` (required): end day (UTC) in `YYYY-MM-DD`.
- `granularity` (required): `day` or `week`.

Validation rules:

- all params are required.
- `from` must be before or equal to `to`.
- max range is 365 days.

## Success response (`200`)

```json
{
  "projectId": "proj_123",
  "range": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-14T23:59:59.999Z"
  },
  "granularity": "week",
  "timezone": "UTC",
  "metrics": [
    "brand_mentions",
    "mention_rate",
    "citation_rate",
    "share_of_voice",
    "valid_responses",
    "sentiment_positive_share"
  ],
  "series": [
    {
      "periodStart": "2026-04-01T00:00:00.000Z",
      "periodEnd": "2026-04-05T23:59:59.999Z",
      "values": {
        "brand_mentions": 9,
        "mention_rate": 0.62,
        "citation_rate": 0.48,
        "share_of_voice": 0.45,
        "valid_responses": 13,
        "sentiment_positive_share": 0.54
      }
    },
    {
      "periodStart": "2026-04-06T00:00:00.000Z",
      "periodEnd": "2026-04-12T23:59:59.999Z",
      "values": {
        "brand_mentions": 0,
        "mention_rate": 0,
        "citation_rate": 0,
        "share_of_voice": 0,
        "valid_responses": 0,
        "sentiment_positive_share": 0
      }
    }
  ],
  "generatedAt": "2026-04-26T12:00:00.000Z"
}
```

## Error response (`400`)

```json
{
  "error": "invalid_timeseries_query",
  "details": {
    "granularity": "granularity must be one of: day, week."
  }
}
```
