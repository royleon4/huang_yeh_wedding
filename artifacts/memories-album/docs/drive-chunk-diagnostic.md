# Google Drive upload diagnostic result

The production experiment disproved the original 4 MiB request-body theory.

Observed production failures:

- `stage: session-status`, `status: 403`, `chunkBytes: 0`
- `stage: drive-request`, `status: 403`, request bodies between about 217 KB and 357 KB

The first result shows that a previously persisted resumable-session status query was rejected even though it sent no file bytes. The second result shows that small Drive writes also failed, so the failure is not explained by a 4 MiB upload boundary.

The Replit Drive proxy now handles only the exact stale-session case:

- a 403 returned for `PUT` with `Content-Range: bytes */total` is treated as an unusable old resumable session
- the Drive adapter discards that session and starts a fresh one
- a 401 remains an authorization failure
- ordinary 403 responses remain unchanged

Diagnostics now distinguish `thumbnail-upload` from generic Drive requests. No token, folder ID, session URI, filename, response body, or file bytes are logged.
