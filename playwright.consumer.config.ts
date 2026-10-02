import { defineConfig, devices } from '@playwright/test';

// Run through `npm run consumer`, which builds the app in CONSUMER_DIR first
const port = 4320;
const root = `${process.env['CONSUMER_DIR']}/dist/consumer/browser`;

export default defineConfig({
  testDir: './consumer',
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node consumer/serve.mjs "${root}" ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});
