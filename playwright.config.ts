import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3212",
    trace: "retain-on-failure",
    colorScheme: "light",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3212",
    url: "http://127.0.0.1:3212/login",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: "postgresql://senda_demo:senda_demo@127.0.0.1:5432/senda_demo",
      OPENAI_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
