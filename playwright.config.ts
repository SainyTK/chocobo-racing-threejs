import { defineConfig } from '@playwright/test';
const port = Number(process.env.TEST_PORT) || 3218;
export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', timeout: 120000, expect: { timeout: 10000 }, workers: 1,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1280, height: 800 }, headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'output/playwright-report' }]],
  outputDir: 'output/playwright-results',
  webServer: { command: `PORT=${port} npm run dev`, url: `http://localhost:${port}/health`, reuseExistingServer: !process.env.CI, timeout: 30000 },
});
