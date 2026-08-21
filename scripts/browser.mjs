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
  return chromium.launch({ ...options, ...(executablePath ? { executablePath } : {}) })
}
