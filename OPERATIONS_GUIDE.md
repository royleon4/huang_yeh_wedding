# 婚禮照片網站｜部署與維運說明

> **Environment:** Current Replit production  
> **Status:** Phase 2.1 browser／In-App／performance gates active  
> **Reviewed:** 2026-08-05T10:31:00+08:00  
> **Baseline:** `09293817935f5548aa4c7ef6918db9afd0a62b98`

其他環境部署：[`docs/site-handbook/deployments/`](docs/site-handbook/deployments/README.md)

## 先記住

1. Secret、database URL、OAuth、Drive ID、private token 不進 GitHub、browser 或一般 logs。
2. Memories production schema 不使用 `drizzle-kit push`。
3. Publish plan 出現 unexpected DROP 就停止。
4. 不直接從 Google Drive 手動刪網站原圖。
5. Liveness 使用 `/Memories/api/health`。
6. Automated Playwright profile 不等於 physical-device evidence。
7. Package／lockfile 改變後，舊 SCA 只算 dated evidence。
8. Bundle budgets 是 regression ceilings，不是效能目標。

## 1. Replit Production

Required Published App Secrets:

```text
DATABASE_URL
MEMORIES_DRIVE_PHOTOS_FOLDER_ID
MEMORIES_ADMIN_TOKEN
```

並連接 Replit Google Drive Integration。Workspace Secrets 不應被假設會自動成為 Published App Secrets。

| Artifact | Port | Route |
| --- | ---: | --- |
| Wedding Invitation | 19315 | `/` |
| Memories | 19316 | `/Memories/*` |
| Legacy API | 8080 | `/api/*` |
| Mockup Sandbox | 8081 | `/__mockup` |

Current deployment target is Autoscale。完整步驟：[`docs/site-handbook/deployments/replit.md`](docs/site-handbook/deployments/replit.md)

## 2. Google Drive

Connected account must read/write:

```text
婚禮 root
00 未分類
訪客上傳
生活照
系統縮圖
```

| Error | Meaning | First action |
| --- | --- | --- |
| `DRIVE_AUTHORIZATION_REQUIRED` | 401/403、account/scope/folder permission | reconnect and verify editor access |
| `DRIVE_RETRYABLE` | 429、5xx、timeout | bounded retry and provider/quota check |

A background job may finish with failures. Always inspect:

```text
attempted
createdOrAttached
failureCount
failureCodes
```

## 3. Health、Browser and Performance

Liveness:

```text
/Memories/api/health
```

Health 200 does not prove React render、Drive access、guestbook、Word layout or browser interaction。

Current browser/performance evidence:

| Evidence | Current behavior |
| --- | --- |
| Cross-browser | Chromium、Firefox、WebKit、Samsung/WeChat/LINE/Facebook/Instagram representatives |
| Failure artifacts | Screenshot、trace、video、HTML report |
| Public first page | 24 photo records |
| Route splitting | Admin、login、private management remain lazy routes |
| Web Vitals | `window.__MEMORIES_WEB_VITALS__` |
| Console diagnostics | Add `?performance=1` |
| Bundle reports | `dist/performance/bundle-report.json` and `.md` |

Bundle ceilings:

| Budget | Ceiling |
| --- | ---: |
| Public entry gzip | 450 KiB |
| Any JS chunk gzip | 800 KiB |
| Total JS gzip | 2 MiB |

## 4. 發佈前驗證

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
```

For UI/route/transform/performance changes, confirm the cross-browser workflow and bundle report。Live Drive tests may use only a safe test folder。

## 5. Migration

Location:

```text
artifacts/memories-album/db
```

Current latest:

```text
016_explicit_guest_album_membership.sql
```

Rules:

- Add the next numbered SQL file only。
- Never modify an applied migration。
- Preserve filename/checksum and advisory lock behavior。
- Start production listening only after migration success。
- Stop on unexpected `DROP TABLE`、`DROP COLUMN` or constraint removal。
- Never use `drizzle-kit push` for Memories production tables。

Production → Development copy/rollback: [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md)

## 6. 安全發佈流程

1. Record candidate `main` commit。
2. Required CI and bundle budgets green。
3. Confirm database backup/PITR。
4. Review migrations and Publish plan。
5. Confirm Published App Secrets and Drive Integration。
6. Record last-known-good revision。
7. Deploy。
8. Verify health。
9. Perform browser and performance smoke。
10. Observe logs/errors for 30–60 minutes。
11. Complete or rollback。

## 7. 發佈後 Smoke

### Public

- [ ] `/Memories/` and `/Memories/en/`
- [ ] Album repeat-click、labels、processes
- [ ] Guestbook load/sort/modal
- [ ] Featured photos stay in current context
- [ ] Bottom navigation stays at visible viewport bottom
- [ ] Back/Forward/refresh/deep links
- [ ] Thumbnail/original/viewer
- [ ] Word content/table/image has no overflow
- [ ] Upload dialog displays current limits

### Admin

- [ ] Login
- [ ] General、Albums/labels、Photos、Categories/content
- [ ] Guestbook accordion stays collapsed until opened
- [ ] One safe save where appropriate

### Performance

- [ ] Admin/login/private modules remain out of public entry
- [ ] First public photo request remains 24
- [ ] Bundle reports exist and budgets pass
- [ ] LCP/CLS snapshot captured
- [ ] An eligible interaction occurs before interpreting INP diagnostic
- [ ] No pageerror、Error Boundary or unexpected console error

## 8. Admin Login

Route:

```text
/Memories/admin/login
```

Secret:

```text
MEMORIES_ADMIN_TOKEN
```

Login creates an approximately 30-minute signed HttpOnly、Secure、SameSite=Strict cookie with Path `/Memories/admin`。

If login returns to public, check session expiry、secret、proxy HTTPS headers、cookie creation and route。Do not move the password/session to localStorage。

## 9. Photos and Thumbnails

If thumbnails are blank, inspect original existence、Drive read access、`系統縮圖` write access、Sharp output、PostgreSQL references and stale cache。

The refresh tool clears generated thumbnails、rescans originals and queues rebuilding。Do not repeatedly start it while a run is active。

## 10. Delete

Use Admin permanent delete or the uploader private-management page。Manual Drive deletion does not clean PostgreSQL relations、thumbnails or pinned references。Current delete has no trash/restore period。

## 11. Dependency Security

The 2026-08-02 SCA is dated evidence, not the current-lockfile verdict。

Before remediation:

1. Frozen-install current `main`。
2. Generate dependency tree、SBOM、pnpm audit、OSV and license evidence。
3. Classify runtime/build/codegen/preview exposure。
4. Update small parent-package batches。
5. Run full Node/build/Playwright/performance gates。
6. Generate post-change SCA tied to the final commit。
7. Deploy with an observation and rollback plan。

Do not blindly use `pnpm audit fix --force`。Runbook: [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md)

## 12. Incident Triage

| Symptom | First direction |
| --- | --- |
| Server/health fail | Migration、environment、port、startup log |
| Health green but blank | Browser pageerror、console、transform、assets |
| All thumbnails fail | Drive account/folder permission |
| Some media fail | Individual original、metadata、Sharp |
| Admin exits | Session/cookie/proxy/secret |
| Upload original exists but classification missing | Repair relations；do not re-upload |
| Featured photos leak | Album/label context、seed、paging |
| Guestbook positioning wrong | Shared navigation/masonry anchor |
| Word content overflow | Document/table/image CSS |
| Bottom nav wrong in In-App browser | Visual viewport、fixed containing block、safe area |
| Bundle budget fails | New eager import、shared chunk、dependency growth |
| Web Vitals regression | LCP candidate、layout reservation、interaction/DOM work |
| Native package crash | Node/OS/architecture/build artifact |

Detailed troubleshooting: [`docs/site-handbook/reference/troubleshooting.md`](docs/site-handbook/reference/troubleshooting.md)

## 13. Rollback

1. Record bad revision and first-error timestamp。
2. Stop risky writes if required。
3. Confirm previous revision is schema-compatible。
4. Switch to/redeploy the last-known-good revision。
5. Verify health、public、admin、Drive and bundle/runtime behavior。
6. Preserve failed-revision evidence。
7. Use a forward fix if schema compatibility blocks rollback。

Never delete migration history。

## 14. Multi-cloud

Current media uses Replit-specific `@replit/connectors-sdk`。Other environments require a production container、Drive API or object-storage adapter、managed PostgreSQL、Secret Manager/runtime identity、explicit migration/background jobs、logs/metrics and backup/restore。

See [`docs/site-handbook/deployments/`](docs/site-handbook/deployments/README.md)。
