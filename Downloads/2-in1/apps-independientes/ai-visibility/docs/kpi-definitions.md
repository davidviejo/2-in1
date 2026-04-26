# KPI definitions (reproducible from detail data)

Estas definiciones son contractuales para la capa KPI del reporting interno.

## Scope and detail entities

All KPIs are derived only from detail-level entities:

- `prompt`
- `run`
- `response`
- `response_brand_mention`
- `citation`

No KPI can depend on manually edited summary values.

## Global inclusion rules

### Valid response (base population)
A response is `valid` iff all conditions hold:

1. `response.status = SUCCEEDED`
2. the parent `run.status = SUCCEEDED`

`valid_response_count` is the size of that set.

### Explicit failed / no-result handling

- `failed_run`: run with `status ∈ {FAILED, CANCELED}`.
- `no_result_run`: run with `status = SUCCEEDED` and **zero valid responses**.

These runs are explicitly tracked (`run_outcomes`) and are excluded from response-based KPI denominators.

## KPI formulas

For all ratios, if denominator is `0`, KPI value is `null` (never implicit `0`).

### 1) `prompt_coverage`

- **Numerator**: active prompts (`prompt.isActive != false`) that have at least one run in range.
- **Denominator**: active prompts in range scope.
- **Formula**: `covered_active_prompts / active_prompts`.

### 2) `valid_response_count`

- **Formula**: `count(valid responses)`.

### 3) `mention_rate`

- **Numerator**: valid responses where `response.mentionDetected = true`.
- **Denominator**: `valid_response_count`.
- **Formula**: `responses_with_mention / valid_response_count`.

### 4) `citation_rate`

- **Numerator**: valid responses with at least one citation row.
- **Denominator**: `valid_response_count`.
- **Formula**: `responses_with_>=1_citation / valid_response_count`.

### 5) `share_of_voice`

- Based on mention rows linked to valid responses.
- **Own mentions**: sum of `mentionCount` where `mentionType = OWN_BRAND`.
- **Competitor mentions**: sum of `mentionCount` where `mentionType = COMPETITOR`.
- **Denominator**: `own_mentions + competitor_mentions`.
- **Formula**: `own_mentions / (own_mentions + competitor_mentions)`.

### 6) `source_share`

- Based on citation rows linked to valid responses.
- Group by normalized `citation.sourceDomain` (trim + lowercase).
- **Per domain formula**: `domain_citations / total_citations`.

### 7) `sentiment_distribution`

- Base: valid responses.
- Buckets:
  - `positive` if `sentiment == "positive"`
  - `neutral` if `sentiment == "neutral"`
  - `negative` if `sentiment == "negative"`
  - `other` otherwise (`null`, empty, or unrecognized label)
- **Per bucket formula**: `bucket_count / valid_response_count`.

### 8) `top_cited_domains`

- Ranking extracted from `source_share`.
- Order: citations desc, domain asc (stable tie-break).
- Default cut: Top 5 (configurable in service).

### 9) `top_prompts`

- Prompt-level metrics computed over valid responses only.
- Per prompt:
  - `valid_response_count`
  - `mention_rate_prompt = prompt_mentions_detected / prompt_valid_response_count`
- Ranking: `mention_rate_prompt` desc, then `valid_response_count` desc, then `promptTitle` asc.
- Include only prompts with `prompt_valid_response_count > 0`.

### 10) `weakest_prompts`

- Same base as `top_prompts`.
- Ranking: inverse of top prompts (lowest mention rate first), same tie-breaks.
- Include only prompts with `prompt_valid_response_count > 0`.

## Exclusions (all KPIs)

Unless explicitly stated otherwise:

- responses from non-succeeded runs
- responses with `status != SUCCEEDED`
- failed/canceled runs from denominator-based response KPIs
- succeeded runs with no valid responses (tracked, not silently absorbed)

## Reproducibility requirement

Every KPI output must expose numerators/denominators or grouped detail counts needed to recompute it exactly from detail rows.
