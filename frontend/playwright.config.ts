import { defineConfig, devices } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PROOFLAB_E2E_URL || localBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PROOFLAB_E2E_URL ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${localBaseUrl}/api/prooflab`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
