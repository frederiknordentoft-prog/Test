// Scope guard for parallel workers: every file changed on this branch (committed since the
// integration branch, staged, unstaged or untracked) must match one of the given globs.
// Globs are relative to talvennerne2/. Usage: npm run scope -- 'src/engine/**' 'docs/x.md'
import { execSync } from 'node:child_process'
import path from 'node:path'

const globs = process.argv.slice(2)
if (globs.length === 0) {
  console.error('scope-guard: angiv mindst én glob, fx npm run scope -- "src/engine/**"')
  process.exit(2)
}

const base = process.env.SCOPE_BASE ?? 'claude/math-app-children-ios-4jihdr'
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).split('\n').filter(Boolean)
const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
const mergeBase = execSync(`git merge-base HEAD ${base}`, { encoding: 'utf8' }).trim()

const files = new Set([
  ...sh(`git -C "${root}" diff --name-only ${mergeBase}`),
  ...sh(`git -C "${root}" diff --name-only --cached`),
  ...sh(`git -C "${root}" ls-files --others --exclude-standard`),
])

const outside = []
for (const file of files) {
  if (!file.startsWith('talvennerne2/')) {
    outside.push(file)
    continue
  }
  const rel = file.slice('talvennerne2/'.length)
  if (!globs.some((g) => path.matchesGlob(rel, g))) outside.push(file)
}

if (outside.length > 0) {
  console.error(`scope-guard: ${outside.length} fil(er) uden for dit område (${globs.join(', ')}):`)
  for (const f of outside) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`scope-guard: ${files.size} ændrede filer, alle inden for ${globs.join(', ')}`)
