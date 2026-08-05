# Project documentation

完整文件索引與 lifecycle：[`../DOCUMENTATION.md`](../DOCUMENTATION.md)

## 主要入口

| 目的 | 文件 |
| --- | --- |
| 從零架站與多雲部署 | [`site-handbook/README.md`](site-handbook/README.md) |
| Replit 部署與事故 | [`../OPERATIONS_GUIDE.md`](../OPERATIONS_GUIDE.md) |
| 開發維護 | [`../MAINTAINER_GUIDE.md`](../MAINTAINER_GUIDE.md) |
| Memories 技術 contract | [`../artifacts/memories-album/README.md`](../artifacts/memories-album/README.md) |
| Test Impact／CI | [`memories/testing-strategy.md`](memories/testing-strategy.md) |
| Phase 2 device evidence | [`memories/phase-2-device-validation-2026-08-05.md`](memories/phase-2-device-validation-2026-08-05.md) |
| Database copy／rollback | [`memories/production-to-development-database-runbook.md`](memories/production-to-development-database-runbook.md) |

## 從零架站文件中心

[`site-handbook/`](site-handbook/README.md) 包含：

- 產品與系統架構
- 技術棧
- 前置工具
- 本機啟動
- Environment／Secrets
- PostgreSQL／Migration
- Google Drive／Object Storage
- Security／Privacy
- Node／Playwright／CI
- Logs／Metrics／Alerts
- Backup／Disaster Recovery
- Replit portability
- Replit、On-premise、Google Cloud、AWS、Azure、Oracle Cloud、Kubernetes 部署
- 命令速查、Troubleshooting、Release checklist

## Security 與 dated evidence

| 文件 | 狀態 |
| --- | --- |
| [`software-composition-analysis-2026-08-02.md`](software-composition-analysis-2026-08-02.md) | Dated SCA evidence；不代表 later lockfiles |
| [`security-remediation-readiness-2026-08-04.md`](security-remediation-readiness-2026-08-04.md) | Current dependency-remediation runbook |
| [`documentation-review-2026-08-04.md`](documentation-review-2026-08-04.md) | Dated documentation review |

在把文件視為 production contract 前，先到 root [`DOCUMENTATION.md`](../DOCUMENTATION.md) 確認它是 Current、Dated evidence、Historical、Diagnostic、Research 或 Internal。
