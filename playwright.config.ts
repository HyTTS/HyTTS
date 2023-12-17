import { defineConfig, devices } from "@playwright/test";

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [["line"]],
    outputDir: "./tmp/playwright/output",
    use: { trace: process.env.CI ? "on" : "off" },
    globalSetup: "./e2e/setup",
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
        { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
        { name: "Mobile Safari", use: { ...devices["iPhone 12"] } },
    ],
});
