# Google Drive 4 MiB chunk diagnostic

This diagnostic is intentionally narrow. It tests the production observation that files requiring more than one 4 MiB resumable chunk fail through the Replit Google Drive connector while a 118 KB file succeeds.

When a non-final 4 MiB upload request receives HTTP 403, the proxy retries the exact same bytes as two valid 2 MiB Drive chunks in the same resumable session.

Server-log interpretation:

- `strategy: 4mib-rejected-retry-2mib` confirms the original 4 MiB request was rejected.
- `strategy: 2mib-subchunks-accepted` proves the same authorization, session, folder, file and bytes work when only the request-body size changes. That identifies a connector request-size boundary rather than a Google Drive permission failure.
- `strategy: 2mib-first-subchunk` or `2mib-second-subchunk-rejected` means the 4 MiB body-size theory was not sufficient. The recorded stage and status should then be used for the next controlled test.

No token, folder ID, session URI, filename, response body or file bytes are logged.
