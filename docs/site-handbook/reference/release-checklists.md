# Release 與維運 Checklist

## 1. 開發開始前

- [ ] 從最新 `main` 建 branch
- [ ] 定義最小 scope
- [ ] 確認是否碰 legacy boundary
- [ ] 確認是否改 route、setting、migration、storage、dependency
- [ ] 找到最低層可證明行為的 test
- [ ] 確認是否需要更新 user/admin/operator docs
- [ ] 不取得不必要的 Production secret/data

## 2. Pull Request

### Code

- [ ] 沒有 unrelated refactor
- [ ] 沒有 secret/provider ID/private token
- [ ] Error 不輸出敏感值
- [ ] Upload/storage/database 操作 idempotent
- [ ] Route 使用 stable identity
- [ ] Migration immutable/additive
- [ ] Browser-visible change 保持中文/English

### Validation

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run typecheck`
- [ ] Impact-selected Node tests
- [ ] Full tests for package/lockfile/runtime/CI changes
- [ ] Production build
- [ ] Health smoke
- [ ] Relevant Playwright profiles
- [ ] Legacy boundary
- [ ] Manual browser evidence when required

### Documentation

- [ ] README summary remains concise
- [ ] User guide updated
- [ ] Admin guide updated
- [ ] Operations guide updated
- [ ] Technical contract updated
- [ ] New doc added to index
- [ ] Date/commit/lifecycle correct

## 3. Database release

- [ ] New numbered SQL only
- [ ] Applied migration files unchanged
- [ ] Backup timestamp recorded
- [ ] Lock/large-table risk reviewed
- [ ] Staging rehearsal
- [ ] Rollback/forward-fix written
- [ ] No unexpected DROP
- [ ] Migration job identity least privilege
- [ ] Migration completes before traffic/new code
- [ ] Row-count/query validation

## 4. Dependency update

- [ ] Fresh SCA from current lockfile
- [ ] Parent dependency/advisory path identified
- [ ] Small batch
- [ ] `pnpm audit fix --force` not used blindly
- [ ] Native package target platform tested
- [ ] Full workspace build
- [ ] Browser gate
- [ ] Post-change SBOM/SCA
- [ ] Remaining findings documented
- [ ] Deployment observation window

## 5. Media/storage change

- [ ] Adapter contract test
- [ ] Original not stored on ephemeral disk
- [ ] Private bucket/folder
- [ ] Runtime least privilege
- [ ] Upload idempotency
- [ ] Checksum verification
- [ ] Multipart/resumable recovery
- [ ] Thumbnail output validation
- [ ] Delete ordering safe
- [ ] Versioning/retention
- [ ] Backup/inventory
- [ ] Migration rollback mapping

## 6. Staging deployment

- [ ] Correct staging database
- [ ] Correct staging media root
- [ ] Correct staging secrets
- [ ] Migration complete
- [ ] Health/readiness green
- [ ] Chinese/English routes
- [ ] Albums/labels/processes
- [ ] Guestbook
- [ ] Photo viewer/original
- [ ] Word content width
- [ ] Upload small test image
- [ ] Private management
- [ ] Admin login/all tabs
- [ ] Browser gate
- [ ] Logs/metrics visible

## 7. Production deployment

### Before

- [ ] Required CI green
- [ ] Approved PR merged
- [ ] Candidate commit/digest recorded
- [ ] Last-known-good revision recorded
- [ ] Backup healthy
- [ ] Migration reviewed
- [ ] Secrets/integration present
- [ ] No provider incident
- [ ] Operator available
- [ ] Observation window reserved

### Deploy

- [ ] Run migration once
- [ ] Check migration exit/log
- [ ] Deploy immutable revision
- [ ] Wait health/readiness
- [ ] Shift traffic
- [ ] Do not delete old revision immediately

### Smoke

- [ ] `/Memories/api/health`
- [ ] `/Memories/`
- [ ] `/Memories/en/`
- [ ] Albums/labels/processes
- [ ] Guestbook load/sort/modal
- [ ] Bottom navigation
- [ ] Thumbnail/original
- [ ] Upload dialog
- [ ] Admin login/tabs
- [ ] One safe save/write
- [ ] Console/pageerror clean

### Observe

- [ ] 5xx
- [ ] p95 latency
- [ ] process/revision restart
- [ ] DB connections/errors
- [ ] media 401/403/429/5xx
- [ ] upload failures
- [ ] thumbnail backlog
- [ ] browser/client errors

## 8. Rollback

- [ ] Incident/revision timestamp recorded
- [ ] Stop risky writes if needed
- [ ] Confirm previous revision schema-compatible
- [ ] Route traffic to last-known-good
- [ ] Verify health/public/admin/media
- [ ] Preserve failed revision logs/evidence
- [ ] Do not delete migration history
- [ ] Restore database/media only when required
- [ ] Write incident review

## 9. Backup check

- [ ] Automated DB backup success
- [ ] PITR window valid
- [ ] Logical dump checksum
- [ ] Media versioning
- [ ] Media inventory count/checksum
- [ ] Backup stored off-system/account
- [ ] Secret/DNS recovery inventory
- [ ] Restore drill date within policy

## 10. Real-device validation

每個 release-blocking row：

- [ ] Device/OS exact version
- [ ] App/browser exact version
- [ ] Network
- [ ] Fresh launch
- [ ] Portrait/landscape
- [ ] Background/resume
- [ ] Deep link
- [ ] Back/Forward/refresh
- [ ] Bottom nav to final content
- [ ] Photo/upload/guestbook modal
- [ ] Keyboard overlap
- [ ] Screenshot/screen recording
- [ ] Result and tester/date

## 11. Documentation-only PR

- [ ] Only Markdown/SVG/non-executable assets
- [ ] Facts match current `main`
- [ ] New links valid
- [ ] Mermaid/SVG syntax reviewed
- [ ] No secret/real IDs
- [ ] No stale test/migration status
- [ ] Documentation CI path behaves as expected
- [ ] Legacy boundary green
