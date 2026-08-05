# 文件導覽與生命週期

> **最後完整審查：** 2026-08-05T10:31:00+08:00（Asia/Taipei）  
> **審查基準：** `main` commit `21dc25543de6dd2bfa7e9019a2a9244c8a2ef186`  
> **產品狀態：** Product Phase 1 complete；Phase 2.1 browser／In-App validation active  
> **從零架站與多雲部署：** [`docs/site-handbook/`](docs/site-handbook/README.md)

## 依角色選文件

| 角色／目的 | 先讀 | 接著讀 |
| --- | --- | --- |
| 親友看照片、留言、上傳 | [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md) | 公開網站本身 |
| 內容管理員 | [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | Memories technical README |
| Replit 部署與事故處理 | [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) | Replit deployment handbook |
| 從零建置同類網站 | [`docs/site-handbook/README.md`](docs/site-handbook/README.md) | 00–11 章與部署文件 |
| 開發／維護 | [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md) | [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) |
| 測試／CI | [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md) | Site handbook testing chapter |
| Database copy／restore | [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) | Backup/DR chapter |
| Dependency security | [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md) | Dated SCA evidence |
| 架構重構 | [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) | Phase 1 closeout／Maintainer Guide |

## 文件狀態

| 狀態 | 意義 |
| --- | --- |
| **Current** | 描述目前 `main` 的行為或必要操作 |
| **Current dated runbook** | 目前可用，但需看日期、commit 與 environment |
| **Dated evidence** | 只證明當時的 commit／事故／掃描結果 |
| **Diagnostic** | 特定故障類型與修復紀錄 |
| **Historical** | 保留早期設計背景，不是目前 contract |
| **Research** | 尚未批准或實作的可行性研究 |
| **Superseded** | 已由新文件或實作取代 |
| **Internal** | Agent／維護者短期記憶，不能取代正式文件 |

## Current 核心文件

### Repository 與角色指南

| 文件 | 說明 |
| --- | --- |
| [`README.md`](README.md) | 精簡專案入口、架構、技術棧、快速啟動與主要文件 |
| [`EASY_USER_GUIDE.md`](EASY_USER_GUIDE.md) | 親友、訪客與上傳者操作 |
| [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | 內容管理員操作 |
| [`OPERATIONS_GUIDE.md`](OPERATIONS_GUIDE.md) | Replit、Drive、migration、發佈與事故處理 |
| [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md) | 開發流程、change impact、testing、release、安全與文件責任 |
| [`artifacts/memories-album/README.md`](artifacts/memories-album/README.md) | Standalone Memories 詳細技術 contract |

### 從零架站與多雲部署

入口：[`docs/site-handbook/README.md`](docs/site-handbook/README.md)

#### 核心章節

| 文件 | 主題 |
| --- | --- |
| [`00-overview.md`](docs/site-handbook/00-overview.md) | 產品、角色、資料流、routes、非功能需求 |
| [`01-technology-stack.md`](docs/site-handbook/01-technology-stack.md) | Node、React、Vite、PostgreSQL、media、tests |
| [`02-prerequisites.md`](docs/site-handbook/02-prerequisites.md) | OS、Git、Node、pnpm、Docker、cloud CLI、IAM |
| [`03-local-development.md`](docs/site-handbook/03-local-development.md) | Clone、local DB、migration、dev、build、smoke |
| [`04-configuration-and-secrets.md`](docs/site-handbook/04-configuration-and-secrets.md) | Environment、Secret、rotation、proxy/cookie |
| [`05-database-and-migrations.md`](docs/site-handbook/05-database-and-migrations.md) | Schema、migration、pool、TLS、backup、restore |
| [`06-media-storage.md`](docs/site-handbook/06-media-storage.md) | Google Drive、object storage、adapter、thumbnail、delete |
| [`07-security-and-privacy.md`](docs/site-handbook/07-security-and-privacy.md) | Threat model、upload、XSS、session、SCA、privacy |
| [`08-testing-and-ci.md`](docs/site-handbook/08-testing-and-ci.md) | Node tests、Playwright、CI、real-device evidence |
| [`09-release-observability.md`](docs/site-handbook/09-release-observability.md) | Health、logs、metrics、alerts、canary、rollback |
| [`10-backup-and-disaster-recovery.md`](docs/site-handbook/10-backup-and-disaster-recovery.md) | RPO/RTO、backup、restore drill、incident recovery |
| [`11-portability.md`](docs/site-handbook/11-portability.md) | Replit 專屬依賴、container、media adapter、多雲移植 |

#### 部署文件

| 環境 | 文件 | Current compatibility |
| --- | --- | --- |
| Replit | [`replit.md`](docs/site-handbook/deployments/replit.md) | Current repository 可直接使用 |
| On-premise／VPS | [`on-premise.md`](docs/site-handbook/deployments/on-premise.md) | 需 container + portable media adapter |
| Google Cloud | [`google-cloud.md`](docs/site-handbook/deployments/google-cloud.md) | 需 GCS 或 Drive API adapter |
| AWS | [`aws.md`](docs/site-handbook/deployments/aws.md) | 需 S3 adapter；推薦 ECS Fargate |
| Microsoft Azure | [`microsoft-azure.md`](docs/site-handbook/deployments/microsoft-azure.md) | 需 Blob adapter |
| Oracle Cloud | [`oracle-cloud.md`](docs/site-handbook/deployments/oracle-cloud.md) | 需 OCI Object Storage adapter |
| Kubernetes | [`kubernetes.md`](docs/site-handbook/deployments/kubernetes.md) | 需 production container、adapter、worker model |

#### Reference

| 文件 | 用途 |
| --- | --- |
| [`command-reference.md`](docs/site-handbook/reference/command-reference.md) | pnpm、PostgreSQL、Docker、cloud、Kubernetes 命令 |
| [`troubleshooting.md`](docs/site-handbook/reference/troubleshooting.md) | Startup、DB、Drive、media、browser、cloud 排錯 |
| [`release-checklists.md`](docs/site-handbook/reference/release-checklists.md) | PR、migration、storage、deploy、rollback、restore checklist |

## Current Memories 專題文件

| 文件 | 主題 |
| --- | --- |
| [`docs/memories/testing-strategy.md`](docs/memories/testing-strategy.md) | Test Impact Analysis、Draft／Ready／main CI |
| [`docs/memories/device-validation-phase-2.md`](docs/memories/device-validation-phase-2.md) | Phase 2 automated profile 與真機 evidence matrix |
| [`docs/memories/production-to-development-database-runbook.md`](docs/memories/production-to-development-database-runbook.md) | Production → Development copy/rollback |
| [`artifacts/memories-album/docs/logical-routes.md`](artifacts/memories-album/docs/logical-routes.md) | Stable route identities |
| [`docs/memories/admin-route.md`](docs/memories/admin-route.md) | Admin route/session boundary |
| [`docs/memories/architecture-boundary.md`](docs/memories/architecture-boundary.md) | Memories 與 legacy ownership |
| [`docs/memories/storage-drive.md`](docs/memories/storage-drive.md) | Google Drive/PostgreSQL data responsibility |
| [`docs/memories/drive-process-sync.md`](docs/memories/drive-process-sync.md) | Drive process discovery/write-through |
| [`docs/memories/legacy-protection.md`](docs/memories/legacy-protection.md) | Protected legacy paths/workflow |
| [`artifacts/memories-album/docs/site-style-wheel-and-viewer.md`](artifacts/memories-album/docs/site-style-wheel-and-viewer.md) | Appearance、wheel、navigation、viewer |

## Dated handoff、安全與成果紀錄

| 文件 | 狀態 |
| --- | --- |
| [`docs/phase-1-closeout-2026-08-01.md`](docs/phase-1-closeout-2026-08-01.md) | Current dated handoff；保留 Phase 1 原始基準 |
| [`docs/software-composition-analysis-2026-08-02.md`](docs/software-composition-analysis-2026-08-02.md) | Dated SCA evidence；不代表後來 lockfile |
| [`docs/security-remediation-readiness-2026-08-04.md`](docs/security-remediation-readiness-2026-08-04.md) | Current dated dependency runbook |
| [`docs/code-health-audit-2026-07.md`](docs/code-health-audit-2026-07.md) | Current dated architecture audit |
| [`docs/memories/content-navigation-achievement-2026-08-02.md`](docs/memories/content-navigation-achievement-2026-08-02.md) | Dated achievement |
| [`docs/memories/random-featured-photo-context-fix-2026-08-04.md`](docs/memories/random-featured-photo-context-fix-2026-08-04.md) | Diagnostic/fix record |
| [`docs/memories/tiptap-image-parser-incident-2026-08-04.md`](docs/memories/tiptap-image-parser-incident-2026-08-04.md) | Diagnostic incident |
| [`docs/memories/word-import-image-upload-2026-08-03.md`](docs/memories/word-import-image-upload-2026-08-03.md) | Dated implementation note |

## Historical、Research 與 Diagnostic

| 文件 | 狀態 |
| --- | --- |
| [`docs/memories/visual-baseline.md`](docs/memories/visual-baseline.md) | Historical／partly superseded |
| [`docs/memories/compreface-feasibility.md`](docs/memories/compreface-feasibility.md) | Research／not approved |
| [`artifacts/memories-album/docs/drive-chunk-diagnostic.md`](artifacts/memories-album/docs/drive-chunk-diagnostic.md) | Diagnostic |

## 目前重要事實

- Product Phase 1 已完成；Phase 2.1 正在擴充 browser／In-App validation。
- Production Playwright gate 已存在，涵蓋 Chromium、Firefox、WebKit 與 representative In-App profiles。
- Automated user-agent profile 不等於真機驗證；真機 matrix 仍需逐列 evidence。
- Migration 目前延伸到 `016_explicit_guest_album_membership.sql`。
- Rich-content import 只支援 Word 相關格式；一般 attachment 只接受圖片。
- Permanent delete 目前沒有七天 trash／restore。
- People classification／selfie search 尚未實作。
- Google Drive media 層目前使用 Replit Connector；其他雲端需要 Drive API 或 object-storage adapter。
- Exact-string Vite transforms 仍是主要架構風險。
- Dated SCA 只代表它掃描的 commit；package/lockfile 改變後必須重掃。

## Source of truth 順序

1. Current `main` code、migration、package manifest、lockfile。
2. 最終 production tests 與 browser evidence。
3. 本頁列為 Current 的文件。
4. 最近 merged PR 與 CI。
5. Dated evidence 只用於其 commit/date。
6. Historical、Research、Issues、舊對話只作背景。

## 文件維護規則

1. User-visible behavior → 更新 user/admin guide。
2. Deployment／incident → 更新 Operations 與相對應 deployment/runbook。
3. API／route／storage／migration／security → 更新 technical contract。
4. Test/CI 改動 → 更新 testing strategy。
5. 新文件加入本索引，標示 lifecycle。
6. Current 文件只能描述已實作且經驗證的行為。
7. Dated record 必須有 ISO 8601 timezone 與 exact commit。
8. 不在文件放 secret、OAuth、private token、database URL、Drive folder ID 或 signed URL。
9. Package／lockfile 改變後，舊 SCA 立即視為 dated。
10. Automated browser profile 與 physical-device evidence 必須分開記錄。
