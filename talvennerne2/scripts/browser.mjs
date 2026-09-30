import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

// The container ships one Chromium build; the npm playwright version may expect a
// different one. Point straight at what is actually on disk instead of downloading.
const CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome',
]

export function launch(options = {}) {
  const executablePath = CANDIDATES.find((p) => existsSync(p))
  // Chromium ignores HTTPS_PROXY, so hand it the agent proxy explicitly when one
  // is configured. Localhost is bypassed so `vite preview` still works.
  const server = process.env.HTTPS_PROXY ?? process.env.https_proxy
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : {}),
    ...(server ? { proxy: { server, bypass: 'localhost,127.0.0.1,::1' } } : {}),
  })
}
