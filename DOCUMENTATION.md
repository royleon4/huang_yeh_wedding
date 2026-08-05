# 文件導覽與生命週期

> **Reviewed:** 2026-08-05T10:31:00+08:00（Asia/Taipei）  
> **Baseline:** `09293817935f5548aa4c7ef6918db9afd0a62b98`  
> **Status:** Product Phase 1 complete；Phase 2.1 browser／In-App／performance gates active

## 依目的選文件

| 目的 | 入口 |
| --- | --- |
| 看照片、留言、上傳 | [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md) |
| 管理網站內容 | [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) |
| Replit 發佈／事故 | [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) |
| 開發／維護 | [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md) |
| Memories 技術 contract | [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) |
| 從零架站／多雲部署 | [`docs/site-handbook/README.md`](docs/site-handbook/README.md) |
| Testing／CI | [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md) |
| Phase 2 真機 evidence | [`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md) |
| Phase 2 效能 gate | [`docs/memories/phase-2-performance-gate-2026-08-05.md`](docs/memories/phase-2-performance-gate-2026-08-05.md) |
| Database copy／rollback | [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) |
| Dependency security | [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md) |

## 文件狀態

| 狀態 | 意義 |
| --- | --- |
| Current | 描述目前 `main` |
| Current dated runbook | 目前可用，但必須看日期／commit／environment |
| Dated evidence | 只證明特定時間與 commit |
| Diagnostic | 特定事故／錯誤／修復紀錄 |
| Historical | 設計背景，不是 current contract |
| Research | 尚未批准或實作 |
| Superseded | 已被新文件／實作取代 |
| Internal | Agent/維護者短期記憶 |

## Current 核心文件

| 文件 | 說明 |
| --- | --- |
| [`README.md`](README.md) | 精簡 repository 入口、架構、技術棧、快速開始 |
| [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md) | 親友與上傳者 |
| [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | 內容管理員 |
| [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) | Replit、Drive、migration、release、incident |
| [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md) | Change impact、testing、release、docs responsibility |
| [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) | Public/Admin/API/Storage/Migration contract |
| [`replit.md`](replit.md) | Replit workspace/artifact context |

## 從零架站與多雲部署

入口：[`docs/site-handbook/README.md`](docs/site-handbook/README.md)

### Core chapters

| # | 文件 | 主題 |
| ---: | --- | --- |
| 00 | [`00-overview.md`](docs/site-handbook/00-overview.md) | 產品、角色、資料流、routes |
| 01 | [`01-technology-stack.md`](docs/site-handbook/01-technology-stack.md) | Node、React、Vite、PostgreSQL、Media、Tests |
| 02 | [`02-prerequisites.md`](docs/site-handbook/02-prerequisites.md) | OS、Git、Node、pnpm、Docker、Cloud CLI |
| 03 | [`03-local-development.md`](docs/site-handbook/03-local-development.md) | Clone、DB、migration、dev、build、smoke |
| 04 | [`04-configuration-and-secrets.md`](docs/site-handbook/04-configuration-and-secrets.md) | Environment、Secret、rotation |
| 05 | [`05-database-and-migrations.md`](docs/site-handbook/05-database-and-migrations.md) | Schema、pool、TLS、backup、restore |
| 06 | [`06-media-storage.md`](docs/site-handbook/06-media-storage.md) | Drive、object storage、adapter、thumbnail |
| 07 | [`07-security-and-privacy.md`](docs/site-handbook/07-security-and-privacy.md) | Auth、upload、XSS、SCA、privacy |
| 08 | [`08-testing-and-ci.md`](docs/site-handbook/08-testing-and-ci.md) | Node、Playwright、CI、real devices |
| 09 | [`09-release-observability.md`](docs/site-handbook/09-release-observability.md) | Health、logs、metrics、alerts、rollback |
| 10 | [`10-backup-and-disaster-recovery.md`](docs/site-handbook/10-backup-and-disaster-recovery.md) | RPO/RTO、backup、restore drill |
| 11 | [`11-portability.md`](docs/site-handbook/11-portability.md) | Replit → portable containers/adapters/jobs |
| 12 | [`12-performance.md`](docs/site-handbook/12-performance.md) | LCP、CLS、INP、code splitting、bundle/image budgets |

### Deployment guides

| Environment | 文件 | Current code 狀態 |
| --- | --- | --- |
| Replit | [`replit.md`](docs/site-handbook/deployments/replit.md) | 可直接使用 current Drive connector |
| On-premise／VPS | [`on-premise.md`](docs/site-handbook/deployments/on-premise.md) | 需 container + portable media adapter |
| Google Cloud | [`google-cloud.md`](docs/site-handbook/deployments/google-cloud.md) | 需 GCS／Drive API adapter |
| AWS | [`aws.md`](docs/site-handbook/deployments/aws.md) | 需 S3 adapter；ECS Fargate |
| Microsoft Azure | [`microsoft-azure.md`](docs/site-handbook/deployments/microsoft-azure.md) | 需 Blob adapter |
| Oracle Cloud | [`oracle-cloud.md`](docs/site-handbook/deployments/oracle-cloud.md) | 需 OCI Object Storage adapter |
| Kubernetes | [`kubernetes.md`](docs/site-handbook/deployments/kubernetes.md) | 需 production container、adapter、worker model |

### References

- [`Command reference`](docs/site-handbook/reference/command-reference.md)
- [`Troubleshooting`](docs/site-handbook/reference/troubleshooting.md)
- [`Release checklists`](docs/site-handbook/reference/release-checklists.md)

## Current Memories specialist docs

| 文件 | 主題 |
| --- | --- |
| [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md) | Test Impact Analysis、Draft／Ready／main CI |
| [`docs/memories/phase-2-device-validation-2026-08-05.md`](docs/memories/phase-2-device-validation-2026-08-05.md) | Automated profiles vs physical-device matrix |
| [`docs/memories/phase-2-performance-gate-2026-08-05.md`](docs/memories/phase-2-performance-gate-2026-08-05.md) | Code splitting、progressive feed、Web Vitals、bundle budgets |
| [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) | Verified DB copy/rollback |
| [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md) | Stable routes |
| [`docs/memories/admin-route.md`](docs/memories/admin-route.md) | Admin session/routes |
| [`docs/memories/architecture-boundary.md`](docs/memories/architecture-boundary.md) | Memories vs legacy ownership |
| [`docs/memories/storage-drive.md`](docs/memories/storage-drive.md) | Drive/PostgreSQL responsibility |
| [`docs/memories/drive-process-sync.md`](docs/memories/drive-process-sync.md) | Process discovery/write-through |
| [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md) | Protected paths/workflow |

## Dated、Diagnostic、Historical、Research

| 文件 | 狀態 |
| --- | --- |
| [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md) | Dated handoff |
| [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md) | Dated SCA evidence |
| [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md) | Current dated runbook |
| [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) | Dated architecture audit |
| [`docs/memories/content-navigation-achievement-2026-08-02.md`](docs/memories/content-navigation-achievement-2026-08-02.md) | Dated achievement |
| [`docs/memories/random-featured-photo-context-fix-2026-08-04.md`](docs/memories/random-featured-photo-context-fix-2026-08-04.md) | Diagnostic |
| [`docs/memories/tiptap-image-parser-incident-2026-08-04.md`](docs/memories/tiptap-image-parser-incident-2026-08-04.md) | Diagnostic |
| [`docs/memories/visual-baseline.md`](docs/memories/visual-baseline.md) | Historical／partly superseded |
| [`docs/memories/compreface-feasibility.md`](docs/memories/compreface-feasibility.md) | Research／not approved |

## Current facts

- Production Playwright gate 已涵蓋 Chromium、Firefox、WebKit 與 representative Samsung/WeChat/LINE/Facebook/Instagram profiles。
- Automated profile 不等於 physical-device proof；真機 matrix 仍需逐列 evidence。
- Performance gate 已加入 route code splitting、first-page 24 photos、Web Vitals diagnostic 與 bundle budgets。
- Migration current latest：`016_explicit_guest_album_membership.sql`。
- Word-related import supported；PDF/PPT 不支援；general attachment 只接受圖片。
- Permanent delete 無七天 trash/restore。
- People classification/selfie search 未實作。
- Current Google Drive media 使用 Replit-specific connector；其他雲端需 adapter。
- Exact-string Vite transforms 仍是主要架構風險。
- Dated SCA 只代表 scanned commit；lockfile 改變後必須重掃。

## Source of truth order

1. Current `main` code、migration、package、lockfile。
2. Production tests／browser／performance evidence。
3. Current documents。
4. Latest merged PR／CI。
5. Dated evidence 只用於其 commit/date。
6. Historical、Research、Issues、old conversations 只作背景。

## 維護規則

1. User-visible behavior → 更新 user/admin guide。
2. Deployment/incident → 更新 Operations 與對應 deployment runbook。
3. API/route/storage/migration/security/performance → 更新 technical contract。
4. Test/CI → 更新 testing strategy/device/performance record。
5. 新文件加入本索引並標示 lifecycle。
6. Current 只描述已實作、已驗證內容。
7. Dated record 使用 ISO 8601 timezone + exact commit。
8. 文件不含 Secret、OAuth、Database URL、Drive ID、private token、signed URL。
