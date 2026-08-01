# Google Drive upload diagnostic result

> **Status:** Diagnostic record; current handling for this failure class  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Use when:** A Drive resumable-session status query or small write returns 403

This record explains one proven production failure mode. It is not a general statement that every Drive 403 is a stale session.

The production experiment disproved the original 4 MiB request-body theory.

Observed production failures:

- `stage: session-status`, `status: 403`, `chunkBytes: 0`
- `stage: drive-request`, `status: 403`, request bodies between about 217 KB and 357 KB

The first result shows that a previously persisted resumable-session status query was rejected even though it sent no file bytes. The second result shows that small Drive writes also failed, so the failure is not explained by a 4 MiB upload boundary.

The Replit Drive proxy handles only the exact stale-session case:

- a 403 returned for `PUT` with `Content-Range: bytes */total` is treated as an unusable old resumable session;
- the Drive adapter discards that session and starts a fresh one;
- a 401 remains an authorization failure;
- ordinary 403 responses remain unchanged.

Diagnostics distinguish `thumbnail-upload` from generic Drive requests. No token, folder ID, session URI, filename, response body, or file bytes may be logged.

## Maintainer cautions

- Do not broaden the stale-session exception to every 403.
- Preserve 401 and ordinary 403 authorization behavior.
- Test zero-byte session-status handling separately from original and thumbnail uploads.
- Correlate failures by timestamp and safe stage/code fields only.
- Recheck Google Drive Integration and folder permissions before changing retry logic.

See [`../../../OPERATIONS_GUIDE.md`](../../../OPERATIONS_GUIDE.md) for general Drive incident handling and [`../../../MAINTAINER_GUIDE.md`](../../../MAINTAINER_GUIDE.md) for change safety.
