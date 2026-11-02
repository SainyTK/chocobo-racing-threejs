import { defineConfig } from '@playwright/test';
const port = Number(process.env.TEST_PORT) || 3218;
/** The local signaling Worker; tests can read it as `SIGNAL_URL`. */
const signalPort = Number(process.env.TEST_SIGNAL_PORT) || port + 5000;
process.env.SIGNAL_URL = `http://localhost:${signalPort}`;
export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', timeout: 120000, expect: { timeout: 10000 }, workers: 1,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1280, height: 800 }, headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'output/playwright-report' }]],
  outputDir: 'output/playwright-results',
  webServer: { command: `PORT=${port} SIGNAL_PORT=${signalPort} npm run dev`, url: `http://localhost:${signalPort}/health`, reuseExistingServer: !process.env.CI, timeout: 60000 },
});
