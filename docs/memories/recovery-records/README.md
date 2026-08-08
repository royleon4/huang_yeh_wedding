# Recovery records

Store sanitized evidence for Standalone Memories restore drills and material recoveries here. Do not store secret values, database URLs, OAuth material, tokens, cookies, signed URLs, Google Drive folder/file identifiers, private message bodies, image bytes, or raw connector responses.

Copy this template to `YYYY-MM-DD-<purpose>.md`.

```markdown
# Recovery record｜YYYY-MM-DD｜purpose

- Date/time UTC:
- Environment: restore | production
- Severity: drill | SEV-1 | SEV-2 | SEV-3
- Event/correlation ID:
- Affected revision:
- Last-known-good revision:
- Symptom code:
- Detection source:
- Write containment required: yes/no
- Backup baseline timestamp:

## Recovery action

- Recovery method:
- Database restore evidence: backup class, timestamp, checksum status, duration; no URL/credential
- Media evidence: expected/verified/missing counts and checksum coverage; no provider IDs
- Migration evidence: filenames + checksum status

## Validation

- [ ] Health
- [ ] Chinese public route
- [ ] English public route
- [ ] Representative album/label/process/deep link
- [ ] Guestbook read
- [ ] Thumbnail/original viewer
- [ ] Admin login
- [ ] Safe reversible restore-environment write
- [ ] No unexpected migration/pageerror/provider-auth loop

## Result

- Outcome: succeeded | partial | failed
- Measured RPO:
- Measured RTO:
- Failed checks:
- Residual risk / missing items:
- Follow-up issue/PR:
- Operator roles:
```

A record is evidence only when its checks were actually executed. Never mark an untested provider backup or media copy as successful.