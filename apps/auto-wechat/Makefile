.PHONY: dev-up dev-down dev-logs dev-build migrate-up api-run worker-run frontend-dev frontend-lint health mysql-fix-auth sync-layout-templates

# 开发环境（Docker 热更新：backend air + llm uvicorn --reload）
dev-up:
	docker compose -f docker-compose.dev.yml up -d --build

# 仅重建 api/worker/llm（改 Go/Python 后首次或依赖变更时用）
dev-build:
	docker compose -f docker-compose.dev.yml up -d --build api worker llm-service

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f api worker llm-service

migrate-up:
	cd backend && go run ./cmd/api/main.go --migrate-only || true

api-run:
	cd backend && go run ./cmd/api/main.go

worker-run:
	cd backend && go run ./cmd/worker/main.go

frontend-dev:
	cd frontend && pnpm install && pnpm dev

frontend-lint:
	cd frontend && pnpm install && pnpm typecheck && pnpm lint

health:
	curl -s http://localhost:8080/api/v1/health
	@echo ""
	curl -s -H "X-API-Key: $$(grep ADMIN_API_KEY .env.development | cut -d= -f2)" http://localhost:8080/api/v1/health/ready
	@echo ""

# Sequel Ace 连不上时：将 wechat 改为 mysql_native_password（容器需已启动）
mysql-fix-auth:
	docker compose -f docker-compose.dev.yml exec mysql mysql -uroot -proot_change_me -e "\
		ALTER USER 'wechat'@'%' IDENTIFIED WITH mysql_native_password BY 'change_me'; \
		CREATE USER IF NOT EXISTS 'wechat'@'localhost' IDENTIFIED WITH mysql_native_password BY 'change_me'; \
		GRANT ALL PRIVILEGES ON wechat_ai.* TO 'wechat'@'localhost'; \
		FLUSH PRIVILEGES;"

# 从 image_assets 写 manifest → 再生 HTML → 更新 layout_templates（按 name 匹配）
# 本地非 Docker 时需指定 MEDIA_DIR，例如：
#   MEDIA_DIR=./media make sync-layout-templates
sync-layout-templates:
	cd backend && go run ./cmd/sync-layout-templates
