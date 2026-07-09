.PHONY: dev-up dev-down dev-logs dev-build migrate-up api-run worker-run frontend-dev frontend-lint health mysql-fix-auth sync-layout-templates

COMPOSE_ENV := --env-file ../../.env.development
COMPOSE := docker compose $(COMPOSE_ENV) -f docker-compose.dev.yml

# 开发环境（需先在 repo 根目录: ./scripts/env-build.sh development）
dev-up:
	$(COMPOSE) up -d --build

dev-build:
	$(COMPOSE) up -d --build api worker llm-service

dev-down:
	$(COMPOSE) down

dev-logs:
	$(COMPOSE) logs -f api worker llm-service

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
	curl -s -H "X-API-Key: $$(grep ADMIN_API_KEY ../../.env.development | cut -d= -f2)" http://localhost:8080/api/v1/health/ready
	@echo ""

mysql-fix-auth:
	@pw="$$(grep '^MYSQL_PASSWORD=' ../../.env.development | cut -d= -f2)"; \
	root="$$(grep '^MYSQL_ROOT_PASSWORD=' ../../.env.development | cut -d= -f2)"; \
	$(COMPOSE) exec mysql mysql -uroot -p"$$root" -e "\
		ALTER USER 'wechat'@'%' IDENTIFIED WITH mysql_native_password BY '$$pw'; \
		CREATE USER IF NOT EXISTS 'wechat'@'localhost' IDENTIFIED WITH mysql_native_password BY '$$pw'; \
		GRANT ALL PRIVILEGES ON wechat_ai.* TO 'wechat'@'localhost'; \
		FLUSH PRIVILEGES;"

sync-layout-templates:
	cd backend && go run ./cmd/sync-layout-templates
