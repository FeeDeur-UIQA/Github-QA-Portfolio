// Jest Setup File
// Suppress console logs during unit tests for cleaner output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error output for debugging
  error: console.error,
};
