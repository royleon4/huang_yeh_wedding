# Documentation audit — 2026-08-01

> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Baseline:** `main` at `4fb33f0655eca557c6755066bce8083b0f15c7df`  
> **Scope:** First-party project, product, operations, architecture, diagnostic and internal handoff documentation

## Scope and exclusions

This review covers documentation written specifically for `royleon4/huang_yeh_wedding` and Standalone Memories.

Imported reference material under `.agents/skills/**` is excluded from factual project review because it is third-party or generic guidance, not a description of this repository.

Source code, tests, migration files, workflow files and package metadata were used to resolve conflicting documentation. They are evidence, not part of the Markdown-document inventory.

## Findings summary

1. User, administrator and operations guides were substantially aligned with the current product.
2. Developer information was distributed across the root README, artifact README, Replit notes, architecture notes, test conventions and internal agent memory.
3. There was no single maintainer workflow covering change impact, migrations, transforms, tests, release discipline and documentation ownership.
4. “Phase 1” was ambiguous: the product baseline and the code-health refactoring plan used the same term.
5. The historical visual baseline still presented obsolete assumptions as binding.
6. The internal `.agents/memory/memories-project-overview.md` contained stale limits, migration numbers and administrator capabilities.
7. Several specialist documents were missing from `DOCUMENTATION.md`, making them difficult to classify as current, historical, diagnostic or research.

## Reviewed inventory

| Document | Intended role | Review result | Action |
| --- | --- | --- | --- |
| `README.md` | Repository entry | Current facts, outdated phase status | Updated to mark Product Phase 1 complete and link the maintainer handoff |
| `DOCUMENTATION.md` | Documentation index | Useful but incomplete | Expanded with lifecycle, all first-party specialist documents and timestamp |
| `EASY_USER_GUIDE.md` | Guests/uploaders | Current | Retained |
| `ADMIN_GUIDE.md` | Content administrators | Current | Retained |
| `OPERATIONS_GUIDE.md` | Deployment/incident operators | Current and appropriately cautious | Retained; linked from maintainer handoff |
| `MAINTAINER_GUIDE.md` | Developers/maintainers | Missing | Added |
| `replit.md` | Replit/workspace context | Current, needed phase terminology | Refined with current handoff links and phase clarification |
| `artifacts/memories-album/README.md` | Detailed technical contract | Current and comprehensive | Retained as the detailed implementation reference |
| `artifacts/memories-album/test/README.md` | Test authors | Current | Added to documentation index |
| `artifacts/memories-album/docs/logical-routes.md` | Route maintainers | Current | Retained |
| `artifacts/memories-album/docs/site-style-wheel-and-viewer.md` | Appearance/navigation/viewer maintainers | Current | Retained |
| `artifacts/memories-album/docs/drive-chunk-diagnostic.md` | Drive incident diagnostics | Current diagnostic record | Added to documentation index as diagnostic, not general architecture |
| `docs/memories/admin-route.md` | Admin routing | Current | Added to documentation index |
| `docs/memories/architecture-boundary.md` | Architecture ownership | Too brief and referenced unimplemented face ownership as current | Refined |
| `docs/memories/storage-drive.md` | Drive/data boundary | Current | Retained |
| `docs/memories/drive-process-sync.md` | Process synchronization | Current | Retained |
| `docs/memories/legacy-protection.md` | Legacy boundary | Current | Retained |
| `docs/memories/visual-baseline.md` | Original visual direction | Contains superseded Phase 1 assumptions | Marked historical and non-authoritative for current behavior |
| `docs/memories/compreface-feasibility.md` | Future face-feature research | Still preliminary and unapproved | Marked research/deferred with current decision status |
| `docs/code-health-audit-2026-07.md` | Architecture debt | Current risk inventory; “Phase 1” wording conflicts with product closeout | Added terminology/status clarification |
| `docs/phase-1-closeout-2026-08-01.md` | Product handoff/roadmap | Missing | Added with timestamp and recommended next steps |
| `.agents/memory/MEMORY.md` | Internal agent index | Index current, target overview stale | Updated |
| `.agents/memory/memories-project-overview.md` | Internal project handoff | Materially stale | Replaced with concise current baseline and links |
| `.agents/memory/csp-dev-preamble.md` | Internal dev diagnostic | Current specialist note | Retained |
| `.agents/memory/admin-token-envvar.md` | Internal secret-name rule | Current | Retained |

## Documentation lifecycle used after this audit

- **Current:** describes merged production behavior or required maintenance procedure.
- **Historical:** retained to explain an earlier design or decision; not a current contract.
- **Superseded:** replaced by another named document or implementation.
- **Research:** feasibility or discovery material; no implementation approval implied.
- **Diagnostic:** evidence and handling for a specific incident class.
- **Internal:** concise agent/developer memory; must point to current public maintainer documents rather than duplicate large facts.

## Source-of-truth conflicts resolved

### Product Phase 1 versus architecture Phase 1

Product Phase 1 is recorded as complete. The risk-containment list in the July code-health audit remains open architecture work and must not be reported as complete.

### Visual baseline

The visual baseline is preserved for design provenance, but its fixed process list and guest-classification assumptions no longer define current production behavior. Current code, tests, stable-route documentation and administrator guides take precedence.

### Internal agent memory

The old overview referenced a 30-file upload maximum, migration 010, a removed visitor-classification assumption and earlier administrator limitations. The current overview avoids brittle duplication and links to maintained source documents.

## Ongoing audit rule

Repeat a documentation audit when any of the following occurs:

- completion of a product phase;
- a route or storage ownership change;
- a new migration family or deployment platform;
- removal of a major transform or application boundary;
- adoption of face/biometric processing;
- a deletion/restore policy change;
- a major incident reveals a missing runbook.

Record the review time in ISO 8601 with timezone and identify the reviewed `main` commit.
