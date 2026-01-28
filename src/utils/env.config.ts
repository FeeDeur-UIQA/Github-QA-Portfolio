import * as fs from 'fs';

import * as dotenv from 'dotenv';

import { z } from 'zod';

// Load environment files in order of precedence
['.env.local', '.env'].forEach((file) => {
  if (fs.existsSync(file)) dotenv.config({ path: file });
});

// Schema with essential validation only
const envSchema = z.object({
  // Application
  BASE_URL: z.string().url().default('https://automationexercise.com'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Playwright Configuration
  WORKERS: z.coerce.number().int().min(1).default(10),
  TIMEOUT: z.coerce.number().int().min(1000).default(35000),
  EXPECT_TIMEOUT: z.coerce.number().int().min(1000).default(5000),
  NAVIGATION_TIMEOUT: z.coerce.number().int().min(1000).default(10000),
  RETRIES: z.coerce.number().int().min(0).default(2),

  // Test Credentials (Demo defaults for portfolio use; override in CI/CD via GitHub Secrets)
  TEST_EMAIL: z.string().email().default('test.user@automation.test'),
  TEST_PASSWORD: z.string().min(6).default('SecurePassword123!'),

  // Optional Secrets
  API_KEY: z.string().optional(),
  API_TOKEN: z.string().optional(),
  SLACK_WEBHOOK: z.string().url().optional().or(z.literal('')),
  GITHUB_TOKEN: z.string().optional(),

  // Feature Flags
  TURBO_MODE: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  HEADLESS: z.coerce.boolean().default(true),
  NOTIFICATION_ENABLED: z.coerce.boolean().default(false),

  // Paths
  LOG_DIR: z.string().default('./logs'),
});

type Env = z.infer<typeof envSchema>;

// Environment utilities (defined before validation to use in error messages)
const isCI = () => Boolean(process.env.CI);

// Validate and export configuration
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  parseResult.error.issues.forEach((issue) => {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error('');
  if (isCI()) {
    console.error('💡 Running in CI/CD? Ensure GitHub Secrets are configured:');
    console.error('   → https://github.com/<your-repo>/settings/secrets/actions');
    console.error('   → See: documentation/GitHub-Secrets-Setup.md');
  } else {
    console.error('💡 Running locally? Create a .env file with required variables:');
    console.error('   → Copy .env.example to .env');
    console.error('   → Fill in required values (TEST_EMAIL, TEST_PASSWORD, etc.)');
  }
  console.error('');
  process.exit(1);
}

export const env: Env = parseResult.data;

// Environment utilities
export const isDevelopment = () => env.NODE_ENV === 'development';
export { isCI };
export const isTurboMode = () => env.TURBO_MODE || isCI();

// Configuration summary for debugging
export const getEnvSummary = () => ({
  environment: env.NODE_ENV,
  workers: env.WORKERS,
  turboMode: isTurboMode(),
  ci: isCI(),
  IS_CI: isCI(), // Compatibility alias
  baseUrl: env.BASE_URL,
  secretsConfigured: {
    testEmail: Boolean(env.TEST_EMAIL),
    testPassword: Boolean(env.TEST_PASSWORD),
    apiKey: Boolean(env.API_KEY),
    slackWebhook: Boolean(env.SLACK_WEBHOOK),
  },
});
