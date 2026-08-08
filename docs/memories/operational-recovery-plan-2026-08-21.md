# Standalone Memories｜Operational recovery plan

> Target completion: 2026-08-21
> Scope: production operations, recovery evidence, backup ownership, restore drills
> Safety: this document records names of configuration classes only. Never record secret values, database URLs, OAuth material, private tokens, signed URLs, or Google Drive folder/file identifiers.

## Outcome required by 2026-08-21

Standalone Memories is operationally recoverable when all four conditions are evidenced:

1. production-impacting events emit or can be recorded using a stable structured event vocabulary;
2. every backup/recovery control has a named role owner and evidence location;
3. a recovery record can identify the affected revision, symptom, containment, recovery action and validation without sensitive identifiers;
4. an isolated restore drill has restored PostgreSQL plus a sanitized media inventory/reference set, started the application, passed validation, and recorded measured RPO/RTO.

Documentation alone is not evidence that provider backup, media export, or a restore succeeded. Rows remain `NOT VERIFIED` until an operator records proof.

## Operational event contract

All machine-generated operational events should be JSON objects. Human incident/recovery records may be Markdown but must use the same event names and correlation fields.

Required common fields:

```json
{
  "timestamp": "RFC3339 UTC",
  "event": "stable_event_name",
  "level": "info|warn|error",
  "service": "memories",
  "environment": "production|restore|development",
  "revision": "git commit or immutable revision label",
  "correlationId": "opaque generated identifier",
  "outcome": "started|succeeded|partial|failed"
}
```

Never place provider object IDs, Drive IDs, credentials, URLs containing tokens, message bodies, image bytes, or raw connector responses in these events.

| Event | Trigger | Minimum additional fields | Owner/action |
| --- | --- | --- | --- |
| `release_started` | production release begins | candidateRevision, previousRevision | Release operator watches gates |
| `release_completed` | observation window closes | durationMs, validationSummary | Release operator records evidence |
| `release_rolled_back` | previous revision restored | badRevision, recoveredRevision, reasonCode | Incident lead validates recovery |
| `migration_started` | production migration starts | migrationCount | DB operator blocks concurrent change |
| `migration_completed` | migration ends | appliedCount, failureCount | DB operator stops release on failure |
| `backup_check_completed` | provider/PITR check | backupClass, freshnessAgeHours, evidenceRef | Backup owner resolves stale/failed state |
| `logical_backup_completed` | logical DB backup finishes | bytes, checksumAlgorithm, encrypted, failureCount | Backup owner verifies off-runtime copy |
| `media_inventory_completed` | media inventory finishes | itemCount, totalBytes, checksumCoverage, failureCount | Media backup owner reconciles gaps |
| `restore_drill_started` | isolated drill begins | backupTimestamp, targetRevision | Drill lead freezes evidence baseline |
| `restore_database_completed` | DB restore finishes | durationMs, migrationChecksumStatus | DB operator validates schema |
| `restore_media_validation_completed` | inventory/media validation ends | expectedCount, verifiedCount, missingCount | Media owner records exceptions |
| `restore_drill_completed` | drill validation closes | measuredRpoMinutes, measuredRtoMinutes, failedChecks | Drill lead signs result |
| `provider_auth_failure` | storage auth fails | providerClass, operationClass, retryable | Operator rotates/reconnects without logging identifiers |
| `data_integrity_mismatch` | count/checksum relation differs | datasetClass, expectedCount, actualCount | Incident lead stops destructive writes |
| `incident_opened` | SEV-1/2 or recovery-impacting incident | severity, symptomCode | Incident lead owns timeline |
| `incident_recovered` | service/data validation passes | recoveryMethod, validationSummary | Incident lead closes only after evidence |

`completed` never implies success. `outcome`, counts, and `failureCount` must make partial completion explicit.

## Ownership matrix

Named people/accounts belong in the private operator roster, not this public repository. The repository records durable roles.

| Control | Accountable role | Executing role | Frequency | Required evidence |
| --- | --- | --- | --- | --- |
| Provider automated DB backup/PITR | Service owner | Backup operator | weekly check | provider status reference + freshness timestamp |
| Encrypted logical DB backup | Service owner | Automation/backup operator | daily target | timestamp, size, SHA-256, encryption=true, off-runtime storage confirmation |
| Media original backup/export | Service owner | Media backup operator | weekly target until automated | inventory timestamp, item count, bytes, checksum coverage, copy status |
| Media inventory reconciliation | Media backup owner | Automation/operator | weekly | expected/verified/missing counts |
| Secret recovery inventory | Security owner | Operator | monthly | secret names only, owner, last rotation/recovery review |
| Last-known-good revision | Release owner | Release operator | every release | commit/revision and validation record |
| Recovery record | Incident lead | Scribe/operator | every recovery | sanitized incident record |
| Restore drill | Service owner | Drill lead + DB/media operators | first drill by 2026-08-21; quarterly thereafter | completed drill record with measured RPO/RTO |

## Recovery evidence record

Create one file per material incident or drill under `docs/memories/recovery-records/`. Use date + opaque purpose, never provider identifiers.

```text
Date/time UTC:
Environment:
Severity:
Event/correlation ID:
Affected revision:
Last-known-good revision:
Symptom code:
Detection source:
Write containment required: yes/no
Backup baseline timestamp:
Recovery method:
Database evidence:
Media evidence:
Validation checks:
Measured RPO:
Measured RTO:
Residual risk / missing items:
Follow-up issue/PR:
Operator roles:
```

Forbidden evidence: secret values, `DATABASE_URL`, OAuth material, admin/private tokens, cookies, signed URLs, Drive folder/file IDs, raw private guestbook content, image bytes, or full connector payloads.

## First restore drill procedure

The first drill must not restore over production.

### Preconditions

- isolate a restore PostgreSQL instance/database from production;
- use a restore runtime that cannot receive production traffic;
- identify the backup timestamp and candidate application revision;
- have a sanitized media inventory/reference set; if an independent original-media backup does not yet exist, record that as a failed recovery control rather than pretending Drive itself is the backup;
- record the production baseline counts needed for comparison without provider IDs.

### Execute

1. Record `restore_drill_started` and start the RTO clock.
2. Restore the selected PostgreSQL backup into the isolated database.
3. Validate the migration ledger/checksums before application writes are allowed.
4. Run pending migrations only if the chosen recovery scenario explicitly requires them; record exactly which migration filenames ran.
5. Connect only the approved restore/safe media source. Never point a destructive drill at production originals.
6. Reconcile media inventory: expected logical photo count, verified original count, missing originals, attachment count, and checksum coverage where available.
7. Start Standalone Memories with restore-environment secrets supplied out-of-band.
8. Verify `/Memories/api/health`.
9. Verify Chinese and English public routes, one album, one label/process route, guestbook read, thumbnail/original viewer, and representative deep links.
10. Verify admin login and one explicitly safe reversible write in the restore database.
11. Verify no unexpected migration, pageerror, or repeated provider-auth error appears in logs.
12. Stop the RTO clock when the defined recovery validation set passes.
13. Calculate measured RPO from backup baseline to incident/drill reference time.
14. Record `restore_drill_completed`, including failed checks and missing recovery controls.
15. Destroy or retain the restore environment according to the recovery-data retention policy; never leave copied production data casually accessible.

### Pass criteria

| Check | Pass condition |
| --- | --- |
| DB restore | restore command succeeds and schema is readable |
| Migration integrity | known migration filenames/checksums match expected baseline |
| Core metadata | album/photo/message counts reconcile to backup baseline or documented delta |
| Originals | zero unexplained missing originals in the tested inventory scope |
| Thumbnails | missing derivatives are acceptable only if rebuild path is verified |
| Public | Chinese/English routes and representative deep links work |
| Admin | login succeeds; safe reversible write succeeds |
| Observability | drill/recovery events contain revision/correlation/outcome and no forbidden fields |
| RPO/RTO | measured values are recorded; target gaps become tracked work |

## Recovery decision order

1. Protect data: stop destructive or ambiguous writes when integrity is uncertain.
2. Preserve evidence: revision, timestamps, sanitized logs, counts, checksums.
3. Prefer rollback for bad code only when schema remains compatible.
4. Prefer database failover/PITR/restore for DB loss; never initialize an empty production database as recovery.
5. Reconnect/rotate storage authorization for auth loss without duplicating uploads.
6. Restore originals before rebuilding derivatives when media loss occurs.
7. Validate public + admin + data integrity before declaring recovery.

## Completion tracker

| Deliverable | Due | State on 2026-08-08 |
| --- | --- | --- |
| Event vocabulary and redaction contract | 2026-08-08 | DOCUMENTED |
| Role-based backup ownership | 2026-08-08 | DOCUMENTED |
| Recovery record template | 2026-08-08 | DOCUMENTED |
| Confirm DB automated backup/PITR and retention | 2026-08-12 | NOT VERIFIED |
| Establish encrypted logical DB backup evidence | 2026-08-14 | NOT VERIFIED |
| Establish independent original-media backup/export + inventory evidence | 2026-08-16 | NOT VERIFIED |
| Confirm secret/config recovery inventory (names only) | 2026-08-17 | NOT VERIFIED |
| Execute isolated restore drill | 2026-08-19 | NOT EXECUTED |
| Remediate drill blockers and repeat failed checks | 2026-08-20 | NOT EXECUTED |
| Sign recovery readiness record | 2026-08-21 | NOT EXECUTED |

## Current known gap

The repository documentation describes desired backup architecture, but repository evidence alone cannot prove that provider PITR, encrypted off-runtime logical dumps, or an independent copy/export of original media currently exists. Those controls must remain explicitly unverified until operator/provider evidence is recorded.