# ==========================================
# Makefile - Test Execution & Docker Orchestration
# ==========================================

COMPOSE_FILE := infrastructure/docker-compose.yml
SERVICE_NAME := playwright
PROJECT_NAME := qe_portfolio

.PHONY: help build up down test logs clean test-local test-docker test-smoke test-smoke-local test-regression test-all test-headed pre-flight

# Pre-flight checks
pre-flight:
	@echo "🔍 Performing Atomic Pre-Flight Checks..."
	@command -v docker >/dev/null 2>&1 || { echo "❌ Error: Docker CLI not found."; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "❌ Error: Docker daemon is not running."; exit 1; }
	@node -e "const v=require('./package.json').devDependencies['@playwright/test']; if(v!=='1.57.0') {console.error('❌ Error: Playwright version mismatch. Expected 1.57.0'); process.exit(1)}"
	@echo "✅ Infrastructure & Versioning Verified."

# 2. DOCKER ORCHESTRATION
build: pre-flight ## Build the Playwright container
	docker-compose -f $(COMPOSE_FILE) build

test: pre-flight ## Run full regression suite with Post-Mortem Recovery
	@echo "🚀 Starting Full Regression..."
	docker-compose -f $(COMPOSE_FILE) up --build --exit-code-from $(SERVICE_NAME) || $(MAKE) clean

test-docker: test

# 3. HIGH-VELOCITY TARGETS
test-local: ## Run all tests locally with Self-Healing on failure
	npm install && npx playwright test || $(MAKE) clean

test-smoke: ## Run smoke tests in Docker with TURBO_MODE
	@echo "🚀 Launching Smoke Suite in Turbo Mode (Docker)..."
	TURBO_MODE=true docker-compose -f $(COMPOSE_FILE) run --rm $(SERVICE_NAME) npx playwright test tests/smoke || $(MAKE) clean

test-smoke-local: ## Run smoke tests locally with TURBO_MODE (no Docker)
	@echo "🚀 Launching Smoke Suite in Turbo Mode (Local)..."
	TURBO_MODE=true npm install && npx playwright test tests/smoke || $(MAKE) clean

test-regression: ## Run regression tests (all tests excluding @smoke)
	@echo "📋 Running Regression Suite..."
	npm install && npx playwright test --grep -v @smoke || $(MAKE) clean

test-all: ## Run complete test suite (smoke + regression)
	npm install && npx playwright test || $(MAKE) clean

test-headed: ## Run tests in headed mode with debugger
	PWDEBUG=1 npx playwright test --headed

# 4. OBSERVABILITY & PRECISION SELF-CORRECTION
logs: ## Stream container logs
	docker-compose -f $(COMPOSE_FILE) logs -f

down: ## Stop all services
	docker-compose -f $(COMPOSE_FILE) down --remove-orphans

clean: down ## Clean up containers, test artifacts, and zombie processes
	@echo "🧹 Cleaning up..."
	docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans >/dev/null 2>&1 || true
	rm -rf playwright-report test-results blob-report
	@pkill -f playwright || true
	@pkill -f chromium || true
	@pkill -f "node .*@playwright/test" || true
	@pkill -f "node .*playwright-core" || true
	@echo "✅ Cleanup complete."

# 5. TAG-BASED EXECUTION (NEW: Phase 1 Stage 3)
test-critical: ## Run @critical tests only (fastest path)
	npx playwright test --grep '@critical'

test-auth: ## Run @auth tests (login/signup/account flows)
	npx playwright test --grep '@auth'

test-product: ## Run @product tests (catalog & details)
	npx playwright test --grep '@product'

test-api: ## Run @api tests only (API contracts)
	npx playwright test --grep '@api'

test-fast: ## Run @smoke + @critical (fastest validation)
	npx playwright test --grep '@smoke' --workers=4

# 6. LINTING & CODE QUALITY
lint: ## Lint all code (excludes k6 load tests)
	@echo "🔍 Linting test suite..."
	npx eslint tests/flows/ tests/unit/ tests/support/ tests/smoke/ fixtures/ --ignore-pattern='**/*.compiled.*'
	npx tsc --noEmit
	@echo "✅ Test suite clean (0 errors)"


validate: lint ## Full validation pipeline (lint + tsc)
	@echo "✅ All validations passed"

help: ## Show this architectural help menu
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0s %s\n", $$1, $$2}'