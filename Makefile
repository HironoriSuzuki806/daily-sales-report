# ================================================================
# 変数（環境変数で上書き可能）
# ================================================================
PROJECT_ID  ?= daily-sales-report-498416
REGION      ?= asia-northeast1
SERVICE     ?= daily-sales-report
REPO        ?= daily-sales-report
IMAGE       := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO)/app
TAG         := $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

# ================================================================
# ヘルプ（デフォルトターゲット）
# ================================================================
.DEFAULT_GOAL := help
.PHONY: help
help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ================================================================
# 開発
# ================================================================
.PHONY: dev
dev: ## 開発サーバーを起動
	npm run dev

.PHONY: ci
ci: type-check lint test build ## CI 全チェック（型・Lint・テスト・ビルド）

.PHONY: type-check
type-check: ## TypeScript 型チェック
	npm run type-check

.PHONY: lint
lint: ## ESLint チェック
	npm run lint

.PHONY: test
test: ## テスト実行（CI 用・ウォッチなし）
	npm run test:run

.PHONY: build
build: ## Next.js ビルド
	npm run build

# ================================================================
# Docker
# ================================================================
.PHONY: docker-build
docker-build: ## Docker イメージをビルド
	docker build -t $(IMAGE):$(TAG) -t $(IMAGE):latest .
	@echo "Built: $(IMAGE):$(TAG)"

.PHONY: docker-run
docker-run: ## Docker コンテナをローカルで起動（要: .env.local）
	docker run --rm -p 3000:3000 \
		--env-file .env.local \
		$(IMAGE):latest

# ================================================================
# GCP デプロイ
# ================================================================
.PHONY: gcp-auth
gcp-auth: ## Artifact Registry 用 Docker 認証を設定
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --project $(PROJECT_ID)

.PHONY: push
push: docker-build ## Docker イメージを Artifact Registry へプッシュ
	docker push $(IMAGE):$(TAG)
	docker push $(IMAGE):latest
	@echo "Pushed: $(IMAGE):$(TAG)"

.PHONY: deploy
deploy: ## Cloud Run へデプロイ（既存イメージを使用）
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE):$(TAG) \
		--project $(PROJECT_ID) \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		--port 3000 \
		--memory 512Mi \
		--cpu 1 \
		--min-instances 0 \
		--max-instances 10 \
		--set-env-vars "NODE_ENV=production"

.PHONY: release
release: push deploy ## ビルド → プッシュ → デプロイ（フルリリース）

# ================================================================
# 監視・運用
# ================================================================
.PHONY: logs
logs: ## Cloud Run のログをストリーミング表示
	gcloud run services logs tail $(SERVICE) --project $(PROJECT_ID) --region $(REGION)

.PHONY: url
url: ## デプロイ済みサービスの URL を表示
	@gcloud run services describe $(SERVICE) \
		--project $(PROJECT_ID) \
		--region $(REGION) \
		--format 'value(status.url)'

# ================================================================
# 初期セットアップ（初回のみ実行）
# ================================================================
.PHONY: setup
setup: ## GCP 初期セットアップ（API 有効化 + Artifact Registry 作成）
	gcloud services enable \
		run.googleapis.com \
		artifactregistry.googleapis.com \
		iam.googleapis.com \
		iamcredentials.googleapis.com \
		cloudresourcemanager.googleapis.com \
		--project $(PROJECT_ID)
	gcloud artifacts repositories create $(REPO) \
		--repository-format docker \
		--location $(REGION) \
		--project $(PROJECT_ID) \
		--description "Docker repository for $(SERVICE)" \
		2>/dev/null || echo "Repository $(REPO) already exists"
	gcloud auth configure-docker $(REGION)-docker.pkg.dev

.PHONY: setup-wif
setup-wif: ## GitHub Actions 用 Workload Identity Federation 設定（初回のみ）
	$(eval PROJECT_NUMBER := $(shell gcloud projects describe $(PROJECT_ID) --format='value(projectNumber)'))
	@echo "=== Workload Identity Pool 作成 ==="
	gcloud iam workload-identity-pools create "github-pool" \
		--project $(PROJECT_ID) \
		--location global \
		--display-name "GitHub Actions Pool" \
		2>/dev/null || echo "Pool already exists"
	@echo "=== Workload Identity Provider 作成 ==="
	gcloud iam workload-identity-pools providers create-oidc "github-provider" \
		--project $(PROJECT_ID) \
		--location global \
		--workload-identity-pool "github-pool" \
		--display-name "GitHub Actions Provider" \
		--attribute-mapping "google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
		--attribute-condition "assertion.repository=='HironoriSuzuki806/daily-sales-report'" \
		--issuer-uri "https://token.actions.githubusercontent.com" \
		2>/dev/null || echo "Provider already exists"
	@echo "=== サービスアカウント作成 ==="
	gcloud iam service-accounts create "github-actions-sa" \
		--project $(PROJECT_ID) \
		--display-name "GitHub Actions Service Account" \
		2>/dev/null || echo "Service account already exists"
	@echo "=== IAM ロール付与 ==="
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member "serviceAccount:github-actions-sa@$(PROJECT_ID).iam.gserviceaccount.com" \
		--role "roles/run.admin"
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member "serviceAccount:github-actions-sa@$(PROJECT_ID).iam.gserviceaccount.com" \
		--role "roles/artifactregistry.writer"
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member "serviceAccount:github-actions-sa@$(PROJECT_ID).iam.gserviceaccount.com" \
		--role "roles/iam.serviceAccountUser"
	@echo "=== WIF とサービスアカウントの紐付け ==="
	gcloud iam service-accounts add-iam-policy-binding \
		"github-actions-sa@$(PROJECT_ID).iam.gserviceaccount.com" \
		--project $(PROJECT_ID) \
		--role "roles/iam.workloadIdentityUser" \
		--member "principalSet://iam.googleapis.com/projects/$(PROJECT_NUMBER)/locations/global/workloadIdentityPools/github-pool/attribute.repository/HironoriSuzuki806/daily-sales-report"
	@echo ""
	@echo "======================================================="
	@echo " GitHub Secrets に以下の値を設定してください"
	@echo "======================================================="
	@echo " WIF_PROVIDER:"
	@echo "   projects/$(PROJECT_NUMBER)/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
	@echo " WIF_SERVICE_ACCOUNT:"
	@echo "   github-actions-sa@$(PROJECT_ID).iam.gserviceaccount.com"
	@echo "======================================================="
