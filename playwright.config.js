import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3210', trace: 'retain-on-failure' },
  webServer: { command: 'PORT=3210 node server/index.mjs', url: 'http://localhost:3210/info.json', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7 landscape'] }, testMatch: /mobile/ },
  ],
});
