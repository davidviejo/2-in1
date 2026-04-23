# Exec Plan: KPI Summary API

## 1) Goal
Build a KPI summary API endpoint that returns a compact dashboard payload for a selected date range (totals + deltas + trend sparkline) so the reporting UI can render without multiple round-trips.

## 2) Scope / Non-Goals
### In scope
- Add one read-only endpoint for KPI summary.
- Aggregate existing metrics (sessions, conversions, revenue, conversion_rate).
- Support date range and optional channel filter.
- Return typed, stable JSON contract with error handling.
- Add unit/integration tests for the endpoint.

### Non-goals
- No redesign of reporting UI.
- No new data ingestion pipeline.
- No historical backfill/migration beyond current stored data.
- No auth model redesign.

## 3) Current State
- Reporting metrics exist but are fetched through multiple granular endpoints.
- UI currently computes part of the summary client-side.
- Date filtering behavior is inconsistent between endpoints.
- Tests cover metric repositories but not an aggregated summary contract.

## 4) Target State
- Single endpoint provides `current`, `previous`, and `delta` blocks plus `trend` series.
- Date filtering is normalized and validated server-side.
- Response schema is versioned and documented.
- UI can consume one endpoint for summary cards and trend preview.

## 5) Files Likely to Change
- `src/api/reporting/summary.(ts|py)`: new controller/handler.
- `src/services/reportingSummaryService.(ts|py)`: aggregation logic.
- `src/repositories/metricsRepository.(ts|py)`: reusable grouped queries.
- `src/schemas/reportingSummary.(ts|py)`: request/response schema.
- `src/routes/reporting.(ts|py)`: route registration.
- `tests/reporting/test_summary_api.*`: endpoint tests.
- `docs/api/reporting-summary.md`: contract documentation.

## 6) Schema / API / UI Impacts
### Schema
- No table changes expected.
- Derived fields: `delta_abs`, `delta_pct`, `trend[]`.

### API
- `GET /api/reporting/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&channel=optional`
- `200` success payload:
  - `range`, `kpis`, `trend`, `generated_at`.
- `400` for invalid date range/format.
- `401/403` unchanged auth behavior.
- `500` standardized internal error object.

### UI
- Reporting summary cards switch to this endpoint.
- Empty state for no data in selected range.
- Error banner with retry action on API failure.

## 7) Rollout Steps
1. Define response contract + schema tests.
2. Implement service aggregation and repository query helpers.
3. Expose endpoint and wire route.
4. Add endpoint unit/integration tests.
5. Update reporting docs and sample response.
6. Deploy behind `REPORTING_SUMMARY_API_ENABLED` flag if available.
7. Enable in staging and validate dashboard behavior.

## 8) Validation Commands
Run from this app's root:
- `npm run lint` or equivalent lint command.
- `npm run test` (or service-specific tests).
- `npm run build`.
- Manual check: request endpoint with valid and invalid ranges.

## 9) Acceptance Criteria
- [ ] Valid request returns aggregated KPI summary in documented schema.
- [ ] Invalid date input returns `400` with actionable message.
- [ ] Trend series length matches date granularity/range.
- [ ] Tests cover success + validation + error paths.
- [ ] Existing reporting flows show no regression.

## 10) Rollback Notes
- Revert endpoint commit and redeploy previous artifact.
- Disable feature flag to force UI back to legacy calls.
- No schema rollback needed (read-only change).

## 11) Open Questions
- Which timezone defines day boundaries for KPI aggregation?
- Should `conversion_rate` be weighted or recomputed from totals?
- Max allowed date range (30/90/365 days) for performance?
- Is channel filter single value or multi-select?
