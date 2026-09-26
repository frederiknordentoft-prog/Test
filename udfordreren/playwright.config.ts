import { defineConfig, devices } from '@playwright/test';

const chromium = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
/**
 * E2E_BASE_URL: kør mod en server, der allerede kører (fx en dev-server i byggefasen:
 * `E2E_BASE_URL=http://localhost:5304 npx playwright test`). Så springes webServer (build + preview) over.
 */
const eksternServer = process.env.E2E_BASE_URL;
/** Røgtesten (nyt spil + reload) kører også på iPad og mobil; resten kun på laptop, så den samlede tid holdes nede */
const ROEGTEST = /@roeg/;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: eksternServer ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: chromium },
  },
  webServer: eksternServer
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: chromium } } },
    {
      name: 'ipad',
      grep: ROEGTEST,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, hasTouch: true, launchOptions: { executablePath: chromium } },
    },
    {
      name: 'mobil',
      grep: ROEGTEST,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, launchOptions: { executablePath: chromium } },
    },
  ],
});
