import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for Disposable Cam
 *
 * Configured with fake camera media stream flags:
 * --use-fake-ui-for-media-stream: Automatically grants camera permission without system dialog
 * --use-fake-device-for-media-stream: Feeds a synthetic video stream to getUserMedia
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",

    // Chromium flags for headless WebRTC camera simulation
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--enable-features=SharedArrayBuffer",
        "--disable-web-security",
        "--allow-file-access-from-files",
      ],
    },
  },

  projects: [
    {
      name: "Pixel-412x802",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 412, height: 802 },
      },
    },
    {
      name: "Pixel-Tall-412x858",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 412, height: 858 },
      },
    },
    {
      name: "iPhone-390x844",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "iPhone-SE-375x667",
      use: {
        ...devices["iPhone SE"],
        defaultBrowserType: "chromium",
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "Budget-Android-360x640",
      use: {
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "iPhone-ProMax-430x932",
      use: {
        ...devices["iPhone 14 Pro Max"],
        defaultBrowserType: "chromium",
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: "Foldable-Inner-800x1200",
      use: {
        viewport: { width: 800, height: 1200 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "Landscape-858x412",
      use: {
        viewport: { width: 858, height: 412 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
