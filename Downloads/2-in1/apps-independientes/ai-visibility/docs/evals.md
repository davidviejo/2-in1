# Evaluation loop (`npm run verify`)

`npm run verify` is the single rerunnable command for fast validation after changes.

## What it runs

1. `npm run lint`
   - Validates Next.js/ESLint rules and catches common code-quality regressions.
2. `npm run typecheck`
   - Runs TypeScript (`tsc --noEmit`) to catch type and API-contract issues at compile time.
3. `npm run test`
   - Runs the full unit test suite with Vitest.
4. `npm run test:smoke`
   - Runs lightweight smoke checks for core app scaffolding invariants.
5. `npm run test:kpi` (conditional)
   - Automatically executed only when `__tests__/kpi.logic.test.ts` exists.
   - If this file exists and any KPI assertion fails, `verify` exits non-zero with a dedicated `KPI logic tests failed` message.

## Failure behavior

- Checks run sequentially and stop on first failure.
- The script prints the failing stage name and exits with a non-zero code.
- KPI tests are intentionally a strict gate once they are present.

## Coverage summary

### Covered
- Static quality (lint).
- Type safety and compile-time contracts.
- Unit-level behavior.
- Lightweight smoke invariants.
- KPI logic gating (as soon as KPI tests are added).

### Not covered (yet)
- End-to-end browser flows.
- Performance/load benchmarks.
- Long-running integration scenarios (kept out to preserve fast reruns).
