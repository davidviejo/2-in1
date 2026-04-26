# Brand mention detection (deterministic v1)

This service provides deterministic mention detection with no LLM dependency.

## Inputs

- Response text.
- Client primary domain + aliases.
- Competitors + aliases.

## Outputs

- `clientMentioned`: `yes/no` represented as boolean.
- `mentionType`: `exact | alias | domain_only | implicit | none`.
- `competitorMentions`: ordered list with `competitorName`, `mentionType`, `matchedTerm`, and text index.

## Normalization rules

1. Lowercase all strings.
2. Apply unicode diacritic folding (`NFKD`) and remove combining marks.
3. Replace non-alphanumeric characters with spaces.
4. Collapse repeated spaces.
5. Normalize domains by removing protocol, `www.`, paths/query/hash, and trailing dots.
6. Exact term for a domain is its root label (`acme.com -> acme`).

## Resolution order

Client mention type priority:

1. `exact`
2. `alias`
3. `domain_only`
4. `implicit`
5. `none`

Competitors follow deterministic per-competitor priority:

1. `exact`
2. `alias`
3. `domain_only`

## Edge cases

- Shared aliases between client and competitors are treated as ambiguous and ignored for both sides.
- Hyphen/underscore variants are normalized, so tokenization can merge forms like `acme-ai` and `acme_ai` into `acme ai`.
- URL mentions in subpaths still count as domain mentions after host normalization.

## Known false-positive risks

- Common-word single-token aliases can match generic prose.
- Root-domain exact tokens (for example `apple` from `apple.com`) may collide with non-brand usage.
- Implicit detection is intentionally strict and limited to explicit pattern rules, so recall is lower by design.
