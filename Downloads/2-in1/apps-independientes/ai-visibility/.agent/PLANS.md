# Execution Plan Template (Codex)

Use this template for any non-trivial task in `apps-independientes/ai-visibility`.
Keep entries concrete, scoped, and verifiable.

## 1) Goal
- One-sentence outcome in user terms.
- Include the exact deliverable and where it will live.

## 2) Scope / Non-Goals
### In scope
- Explicit list of what will be implemented in this task.

### Non-goals
- Explicit list of what will **not** be changed.
- Include adjacent systems/routes that are intentionally excluded.

## 3) Current State
- What exists today (code paths, endpoints, components, schemas).
- Known constraints (feature flags, tech debt, data quality, auth, rate limits).
- Relevant assumptions (state them so reviewers can challenge them).

## 4) Target State
- Desired end-state after merge.
- User-visible behavior and expected system behavior.
- Any backward-compatibility guarantees.

## 5) Files Likely to Change
- `path/to/file`: why it will change.
- `path/to/file`: why it will change.
- Add migrations/config/docs/tests explicitly if expected.

## 6) Schema / API / UI Impacts
### Schema
- New/changed entities, fields, indexes, migrations.
- Compatibility and data backfill notes.

### API
- Endpoints added/changed/removed.
- Request/response shape changes (include status/error contract).
- Auth, pagination, filtering, caching implications.

### UI
- Screens/components affected.
- Loading/empty/error states.
- Accessibility and i18n considerations if relevant.

## 7) Rollout Steps
1. Implement minimal vertical slice.
2. Add/adjust tests.
3. Validate locally.
4. Enable behind flag (if needed).
5. Roll out to target environment.
6. Monitor and iterate.

## 8) Validation Commands
- Exact commands to prove correctness in this repo.
- Example format:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run dev` + manual smoke checklist

## 9) Acceptance Criteria
- [ ] Functional criterion with observable output.
- [ ] API contract criterion (status codes + payload).
- [ ] Performance/reliability criterion (if applicable).
- [ ] Documentation updated.
- [ ] No regressions in related flows.

## 10) Rollback Notes
- Safe rollback method (revert commit, disable flag, redeploy previous build).
- Data rollback strategy (if schema/data touched).
- User impact during rollback.

## 11) Open Questions
- Unknowns requiring clarification before implementation.
- Decision owners and expected resolution timing.

---

## Quick Checklist (before execution)
- [ ] Scope is narrow and testable.
- [ ] Validation commands are executable in current environment.
- [ ] Risks and rollback are documented.
- [ ] Open questions are explicitly listed.
