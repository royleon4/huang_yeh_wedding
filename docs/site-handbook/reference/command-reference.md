# 命令速查

## Repository

```bash
git clone https://github.com/royleon4/huang_yeh_wedding.git
cd huang_yeh_wedding
git status
git log -1 --oneline
```

## pnpm workspace

```bash
corepack enable
pnpm install
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm -r list --depth 0
```

## Standalone Memories

```bash
pnpm --filter @workspace/memories-album dev
pnpm --filter @workspace/memories-album test
pnpm --filter @workspace/memories-album run test:impact
pnpm --filter @workspace/memories-album run test:layout-navigation
pnpm --filter @workspace/memories-album run test:layout-guestbook
pnpm --filter @workspace/memories-album run test:layout-browser
pnpm --filter @workspace/memories-album build
pnpm --filter @workspace/memories-album start
pnpm --filter @workspace/memories-album db:migrate
pnpm --filter @workspace/memories-album test:drive-live
```

## Local production smoke

```bash
pnpm --filter @workspace/memories-album build
PORT=19316 pnpm --filter @workspace/memories-album start &
SERVER_PID=$!
curl --fail http://127.0.0.1:19316/Memories/api/health
kill "$SERVER_PID"
```

## PostgreSQL

```bash
psql "$DATABASE_URL" -c 'select now();'
psql "$DATABASE_URL" -c '\dt'
psql "$DATABASE_URL" -c 'select current_database(), current_user;'
```

Backup：

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > memories.dump
sha256sum memories.dump
```

Restore：

```bash
pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" memories.dump
```

## Docker

```bash
docker build -t wedding-memories:local .
docker run --rm -p 8080:8080 --env-file .env wedding-memories:local
docker compose up -d
docker compose ps
docker compose logs -f app
docker compose down
```

刪本機 volumes：

```bash
docker compose down -v
```

這會永久刪除 Compose volumes。

## Playwright

Current workflow 會安裝 pinned runner。手動重現：

```bash
pnpm --filter @workspace/memories-album add --save-dev @playwright/test@1.60.0 --lockfile=false
pnpm --filter @workspace/memories-album exec playwright install --with-deps chromium firefox webkit
pnpm --filter @workspace/memories-album exec playwright test --config playwright.config.mjs
```

不要把 temporary Playwright install 寫回 production lockfile，除非正式決定把它加入 package manifest。

## GitHub Actions

```bash
gh pr checks
 gh run list --limit 20
 gh run view RUN_ID --log-failed
```

## OpenSSL

```bash
openssl rand -base64 48
openssl s_client -connect example.com:443 -servername example.com </dev/null
```

## DNS

```bash
dig +short example.com
dig CNAME example.com
dig TXT example.com
```

## HTTP

```bash
curl -I https://example.com/Memories/
curl --fail --silent --show-error https://example.com/Memories/api/health
curl -v https://example.com/Memories/api/health
```

## Google Cloud

```bash
gcloud auth login
gcloud config set project PROJECT_ID
gcloud run services list --region REGION
gcloud run revisions list --service SERVICE --region REGION
gcloud logging read 'resource.type="cloud_run_revision"' --limit 50
```

## AWS

```bash
aws sso login
aws sts get-caller-identity
aws ecs describe-services --cluster CLUSTER --services SERVICE
aws ecs list-tasks --cluster CLUSTER --service-name SERVICE
aws logs tail /wedding/memories --follow
aws rds describe-db-instances --db-instance-identifier INSTANCE
```

## Azure

```bash
az login
az account show
az containerapp show -g RESOURCE_GROUP -n APP
az containerapp revision list -g RESOURCE_GROUP -n APP -o table
az containerapp logs show -g RESOURCE_GROUP -n APP --follow
az postgres flexible-server show -g RESOURCE_GROUP -n SERVER
```

## OCI

```bash
oci iam region list
oci container-instances container-instance list --compartment-id COMPARTMENT_OCID
oci container-instances container-instance get --container-instance-id OCID
oci os bucket list --compartment-id COMPARTMENT_OCID
oci logging log list --log-group-id LOG_GROUP_OCID
```

## Kubernetes

```bash
kubectl config current-context
kubectl get pods -n wedding-prod
kubectl describe deployment wedding-memories -n wedding-prod
kubectl logs deployment/wedding-memories -n wedding-prod --tail=200 -f
kubectl rollout status deployment/wedding-memories -n wedding-prod
kubectl rollout history deployment/wedding-memories -n wedding-prod
kubectl rollout undo deployment/wedding-memories -n wedding-prod
kubectl get events -n wedding-prod --sort-by=.lastTimestamp
```

## SCA/SBOM evidence

實際 tool versions 依 security runbook 固定：

```bash
pnpm audit --json > pnpm-audit.json
pnpm list -r --depth Infinity --json > dependency-tree.json
pnpm licenses list --json > licenses.json
pnpm outdated -r --format json > outdated.json
sha256sum *.json > checksums.txt
```

OSV-Scanner 與 CycloneDX generator 使用經審查的 pinned version；結果必須記錄 scanned commit。
