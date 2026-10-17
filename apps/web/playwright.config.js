import { defineConfig } from "@playwright/test";
var playwright_config_default = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:5173", browserName: "chromium", viewport: { width: 1440, height: 920 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: [
    { command: "npm --workspace apps/api run dev", cwd: "../..", url: "http://localhost:4100/health", reuseExistingServer: !process.env.CI, timeout: 3e4 },
    { command: "npm --workspace apps/web run dev -- --port 5173", cwd: "../..", url: "http://localhost:5173", reuseExistingServer: !process.env.CI, timeout: 3e4 }
  ]
});
export {
  playwright_config_default as default
};
