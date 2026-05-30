// ============================================================
// Worker process for parallel simulation. Computes one seed-range
// chunk and prints the partial result as a single JSON line.
//
// Usage: tsx simChunk.ts <main|sens> <startSeed> <count> <budget>
// ============================================================

import { runMainChunk, runSensChunk } from './simCore';

const [mode, startStr, countStr, budgetStr] = process.argv.slice(2);
const startSeed = Number(startStr);
const count = Number(countStr);
const budget = Number(budgetStr);

const result =
  mode === 'sens' ? runSensChunk(startSeed, count, budget) : runMainChunk(startSeed, count, budget);

// Emit exactly one JSON line on stdout.
process.stdout.write(JSON.stringify(result) + '\n');
