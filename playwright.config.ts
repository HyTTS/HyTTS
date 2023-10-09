import { defineConfig, devices } from "@playwright/test";

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [process.env.CI ? ["html", { outputFolder: "./tmp/playwright/report" }] : ["line"]],
    outputDir: "./tmp/playwright/output",
    use: {
        baseURL: process.env.IN_CONTAINER ? "http://hytts:3700" : "http://127.0.0.1:3700",
        trace: process.env.CI ? "on" : "off",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
        { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
        { name: "Mobile Safari", use: { ...devices["iPhone 12"] } },
    ],
    webServer: {
        command: "yarn dev",
        url: "http://127.0.0.1:3700",
        reuseExistingServer: !process.env.CI,
    },
});
