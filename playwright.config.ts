import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', timeout: 120000, expect: { timeout: 10000 }, workers: 1,
  use: { baseURL: 'http://localhost:3000', viewport: { width: 1280, height: 800 }, headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'output/playwright-report' }]],
  outputDir: 'output/playwright-results',
  webServer: { command: 'npm run dev', url: 'http://localhost:3000/health', reuseExistingServer: !process.env.CI, timeout: 30000 },
});
