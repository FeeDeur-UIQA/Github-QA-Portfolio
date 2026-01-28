# STAGE 1: Dependency Management
FROM mcr.microsoft.com/playwright:v1.49.0-jammy AS deps

WORKDIR /app

# Copy only the files needed for installation to use Docker layer caching
COPY package*.json ./

# Use 'npm ci' for deterministic dependency resolution in CI/CD
RUN npm ci

# STAGE 2: Test Execution Environment
FROM mcr.microsoft.com/playwright:v1.49.0-jammy AS runner

# Set Environment Variables for Playwright
ENV NODE_ENV=test
ENV CI=true
ENV PLAYWRIGHT_JSON_OUTPUT_NAME=results.json

WORKDIR /app

# Copy node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the entire project context (respecting .dockerignore)
COPY . .

# Security: Principle of Least Privilege
# The Microsoft image provides 'pwuser' by default
USER pwuser

# Healthcheck: Ensure the environment is ready for testing
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD npx playwright --version || exit 1

# Default command: Runs all tests defined in the root playwright.config.ts
CMD ["npx", "playwright", "test"]