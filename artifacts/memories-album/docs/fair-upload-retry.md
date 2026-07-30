# Fair upload retry scheduling

The browser upload queue uses two fair passes:

1. Each photo gets at most two attempts during the first pass.
2. A retryable failure is returned to the waiting queue so later photos can start.
3. After every selected photo has had a turn, deferred photos get a second pass of at most two attempts.
4. Permanent validation and authorization failures are not deferred automatically.
5. Completed photos retain their batch and client upload identifiers and are never resent.

One automatic run therefore makes at most four browser requests for a persistently transient photo, while other photos continue through the queue. Manual retry uses the same fair scheduling and retains resumable Google Drive state.

This change does not alter the database schema and does not add a migration.
