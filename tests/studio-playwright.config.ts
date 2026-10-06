import { defineConfig } from '@playwright/test';

const port = Number(process.env.STUDIO_TEST_PORT) || 5181;
export default defineConfig({
  testDir: '.', testMatch: 'studio-music.browser.ts', timeout: 60000, workers: 1,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1280, height: 800 }, headless: true, screenshot: 'only-on-failure' },
  reporter: 'list', outputDir: '../output/studio-playwright-results',
  webServer: {
    command: `STUDIO_TEST=1 npx vite --config studio/vite.config.ts --port ${port} --strictPort`,
    cwd: '..', url: `http://localhost:${port}`, reuseExistingServer: !process.env.CI, timeout: 30000,
  },
});
