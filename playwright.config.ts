import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173/Project-Rando/',
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
  },
  reporter: 'list',
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/Project-Rando/',
    reuseExistingServer: true,
  },
});
