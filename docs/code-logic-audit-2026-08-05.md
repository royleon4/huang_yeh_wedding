# Repository code logic audit — 2026-08-05

Status: Implemented on `maintenance/repo-wide-logic-audit-2026-08-05`

## Boundary

This audit reviewed the workspace configuration and each active package: the Memories archive, the standalone API server, the wedding invitation, the mockup sandbox, shared libraries, build scripts, and CI workflows. Changes were limited to demonstrable logic, validation, error-handling, terminology, and test-gate defects.

No existing layout, spacing, typography, dimensions, colors, body DOM order, or responsive breakpoint was intentionally changed. Generated UI structure and transform-chain architecture were not rewritten because that would require a separate migration plan and visual regression baseline.

## Corrected defects

### Routing and path handling

- `/MemoriesX` and `/Memories-admin` are no longer accepted as `/Memories` routes.
- Blank photo identifiers no longer produce a trailing `/photos/` route.
- Asset paths now reject malformed percent encoding, null bytes, backslashes, and directory traversal as a bounded client error instead of escalating to an internal error.
- Server path decoding is centralized and tested.

### Wedding-process synchronization

- Process folder formatting now accepts only integer orders from 1 through 99 and cannot generate a folder name that its own parser rejects.
- New process creation uses the first available numbered gap instead of incorrectly reporting a limit when folder `99` exists.
- A stale or unknown process ID now returns `PROCESS_NOT_FOUND`; it no longer silently moves the original photo into the unclassified folder.

### Message import

- Local ISO timestamps containing seconds or milliseconds now use the administrator browser timezone offset, matching the documented policy.
- Explicit-timezone ISO timestamps retain their explicit timezone.
- Duplicate canonical columns are rejected instead of silently selecting the first one.
- The configured maximum row count must be a positive safe integer.
- Date error wording now distinguishes local date formats from ISO 8601 values that carry an explicit timezone.

### Request and setting validation

- JSON body-size limits are validated before streaming; invalid internal configuration cannot disable the limit through `NaN`, infinity, fractions, or non-positive values.
- Site-copy length handling counts Unicode characters consistently and does not split surrogate pairs or emoji.
- Missing or blank overlay opacity uses the documented default, while an explicit numeric zero remains valid.
- Site-style validation no longer accepts empty strings or numeric strings as real numeric opacity values.
- Category labels, category order IDs, and video booleans require their documented JSON types.
- Process-content booleans no longer interpret the string `"false"` as `true`.

### Attachment and photo safety

- Process attachments require a supported MIME type and the matching filename extension; a valid value on only one side is no longer sufficient.
- Empty attachments are rejected.
- API-server photo uploads use server-generated UUID names and MIME-derived extensions rather than trusting the original filename.
- Unsupported photo formats, missing files, file-count limits, and file-size limits receive distinct bounded responses.
- Storage implementation errors are logged server-side and are no longer returned verbatim to clients.
- Served photo content types are restricted to the supported image policy with suffix fallback and `nosniff`.

### API-server lifecycle and object storage

- `PORT` must be a complete integer from 1 through 65535.
- Listen failures are handled on the returned server's `error` event; the callback is no longer treated as if it received an error argument.
- Unknown API routes and unhandled request failures return deterministic JSON.
- Object paths require a non-empty bucket and safe object segments.
- Signed-URL and download-cache TTLs are bounded integers.
- Object-path parsing was separated from cloud-client initialization so it can be tested without credentials or network access.

### Terminology

The default copy no longer promises that face classification or selfie search will arrive in “Phase 2”. The current wording states only that those functions are not available yet and that no selfie or face recognition is currently performed. This aligns user-facing text with the current Phase 2 focus on validation, performance, and stability.

## Automated gates added or extended

- Memories route, path, process-sync, message-import, JSON-limit, Unicode-copy, and style-validation regression tests.
- API-server configuration, photo-policy, and object-path unit tests using Node 24 built-in TypeScript stripping; no new package dependency or lockfile change is required.
- Workspace CI now runs API-server unit tests before typecheck and build.

## Deliberately deferred structural work

The audit found existing architectural debt around generated source transforms, very large React components, duplicated UI primitives, and source-text contract tests. These are documented in the prior code-health audit. They were not rewritten here because a broad transformation would change implementation order and potentially rendered DOM or styling. Such work requires a dedicated migration branch, component-level visual baselines, and incremental replacement rather than an unbounded cleanup commit.
