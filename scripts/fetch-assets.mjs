#!/usr/bin/env node
/**
 * Asset fetcher for the FPS warehouse vertical slice.
 *
 * Downloads HDRIs / PBR textures / models from the Poly Haven API and
 * CC0 packs from kenney.nl into public/assets/, then writes
 * public/assets/manifest.json mapping logical names -> file paths.
 *
 * Run:  node scripts/fetch-assets.mjs          (minimal Phase-0 set)
 *       node scripts/fetch-assets.mjs --full   (full warehouse wishlist)
 *
 * This script runs at dev-setup time only — the app never calls these
 * APIs at runtime. Idempotent: existing files are skipped.
 *
 * Licensing: Poly Haven assets and Kenney assets are CC0. The Poly Haven
 * *API* is free for non-commercial use; commercial API usage requires a
 * license (see README).
 */

import { mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const UA = 'fps-vertical-slice/1.0 (github.com/frederiknordentoft-prog/test)';
const API = 'https://api.polyhaven.com';
const OUT = 'public/assets';
const FULL = process.argv.includes('--full');

const summary = { fetched: [], skipped: [], failed: [], manual: [] };

// ---------------------------------------------------------------------------
// Wishlist — warehouse theme. `minimal: true` entries are the Phase-0 set.
// Discovery (categories + preferred tags) is the source of truth; tryIds are
// just "attempt these first" hints and are skipped if they 404.
// ---------------------------------------------------------------------------

const HDRIS = [
  {
    logical: 'env_warehouse',
    minimal: true,
    tryIds: ['empty_warehouse_01'],
    discover: { categories: 'indoor', tags: ['warehouse', 'industrial', 'garage', 'workshop', 'factory', 'empty', 'hangar'] },
    res: '2k',
  },
  {
    logical: 'env_warehouse_alt',
    minimal: false,
    tryIds: ['industrial_workshop_foundry'],
    discover: { categories: 'indoor', tags: ['industrial', 'workshop', 'factory', 'garage'] },
    res: '2k',
  },
];

const TEXTURES = [
  {
    logical: 'floor_concrete',
    minimal: true,
    discover: { categories: 'concrete', tags: ['worn', 'painted', 'dirty', 'industrial', 'floor'] },
    res: '2k',
  },
  {
    logical: 'floor_concrete_plain',
    minimal: false,
    discover: { categories: 'concrete', tags: ['floor', 'clean', 'smooth'] },
    res: '2k',
  },
  {
    logical: 'wall_metal',
    minimal: true,
    discover: { categories: 'metal', tags: ['corrugated', 'painted', 'panel', 'plate'] },
    res: '2k',
  },
  {
    logical: 'wall_rust',
    minimal: false,
    discover: { categories: 'metal', tags: ['rust', 'rusty', 'corroded', 'dirty'] },
    res: '2k',
  },
  {
    logical: 'wall_brick_painted',
    minimal: false,
    discover: { categories: 'brick', tags: ['painted', 'industrial', 'worn'] },
    res: '2k',
  },
  {
    logical: 'detail_diamond_plate',
    minimal: false,
    discover: { categories: 'metal', tags: ['diamond', 'plate', 'floor'] },
    res: '2k',
  },
  {
    logical: 'wood_plank',
    minimal: false,
    discover: { categories: 'wood', tags: ['plywood', 'pallet', 'plank', 'rough'] },
    res: '2k',
  },
];

const MODELS = [
  {
    logical: 'prop_box',
    minimal: true,
    tryIds: ['cardboard_box_01'],
    discover: { tags: ['cardboard', 'box'] },
    res: '1k',
  },
  { logical: 'prop_barrel', minimal: false, tryIds: ['Barrel_01', 'barrel_03'], discover: { tags: ['barrel', 'drum'] }, res: '1k' },
  { logical: 'prop_crate', minimal: false, tryIds: ['wooden_crate_01'], discover: { tags: ['crate', 'wooden'] }, res: '1k' },
  { logical: 'prop_crate_alt', minimal: false, tryIds: ['wooden_crate_02', 'plastic_crate_01'], discover: { tags: ['crate'] }, res: '1k' },
  { logical: 'prop_barrier', minimal: false, tryIds: ['concrete_road_barrier'], discover: { tags: ['barrier', 'concrete'] }, res: '1k' },
  { logical: 'prop_extinguisher', minimal: false, tryIds: ['korean_fire_extinguisher_01'], discover: { tags: ['extinguisher', 'fire'] }, res: '1k' },
];

const KENNEY = [
  { logical: 'proto_textures', slug: 'prototype-textures', minimal: true },
  { logical: 'weapon_kit', slug: 'blaster-kit', minimal: true },
  // Nice-to-have extra prop packs — best effort, never block on these.
  { logical: 'survival_kit', slug: 'survival-kit', minimal: false },
  { logical: 'conveyor_kit', slug: 'conveyor-kit', minimal: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, dest) {
  if (await exists(dest)) {
    summary.skipped.push(dest);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  summary.fetched.push(dest);
  console.log(`  ↓ ${dest}`);
}

/** Pick the best available resolution entry, preferring `wanted`. */
function pickRes(tree, wanted) {
  if (!tree) return null;
  for (const r of [wanted, '1k', '2k', '4k']) {
    if (tree[r]) return tree[r];
  }
  return null;
}

/** Score an asset listing entry against preferred tags. */
function scoreAsset(id, info, tags) {
  const hay = `${id} ${info.name ?? ''} ${(info.tags ?? []).join(' ')}`.toLowerCase();
  return tags.reduce((s, t) => s + (hay.includes(t.toLowerCase()) ? 1 : 0), 0);
}

/** Resolve a wishlist entry to a concrete Poly Haven asset id. */
async function resolveId(entry, type, taken) {
  for (const id of entry.tryIds ?? []) {
    try {
      await fetchJson(`${API}/info/${id}`);
      return id;
    } catch {
      console.log(`  (try-first id "${id}" not found, falling back to discovery)`);
    }
  }
  const q = entry.discover.categories ? `&categories=${entry.discover.categories}` : '';
  const listing = await fetchJson(`${API}/assets?type=${type}${q}`);
  const ranked = Object.entries(listing)
    .filter(([id]) => !taken.has(id))
    .map(([id, info]) => [id, scoreAsset(id, info, entry.discover.tags)])
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] === 0) {
    // Nothing matched the tags — take the first untaken asset rather than fail.
    if (!ranked.length) return null;
  }
  return ranked[0][0];
}

// ---------------------------------------------------------------------------
// Poly Haven fetchers
// ---------------------------------------------------------------------------

async function fetchHdri(entry, manifest, taken) {
  const id = await resolveId(entry, 'hdris', taken);
  if (!id) {
    summary.failed.push(`${entry.logical}: no HDRI resolved`);
    return;
  }
  taken.add(id);
  const files = await fetchJson(`${API}/files/${id}`);
  const res = pickRes(files.hdri, entry.res);
  if (!res?.hdr?.url) {
    summary.failed.push(`${entry.logical}: ${id} has no .hdr file`);
    return;
  }
  const dest = `${OUT}/hdri/${id}_${entry.res}.hdr`;
  await downloadFile(res.hdr.url, dest);
  manifest[entry.logical] = { id, type: 'hdri', path: dest.replace(/^public/, '') };
}

const MAP_KEYS = [
  ['Diffuse', 'diffuse'],
  ['nor_gl', 'normal'],
  ['Rough', 'rough'],
  ['AO', 'ao'],
  ['arm', 'arm'],
  ['Displacement', 'displacement'],
];

async function fetchTexture(entry, manifest, taken) {
  const id = await resolveId(entry, 'textures', taken);
  if (!id) {
    summary.failed.push(`${entry.logical}: no texture resolved`);
    return;
  }
  taken.add(id);
  console.log(`  ${entry.logical} -> ${id}`);
  const files = await fetchJson(`${API}/files/${id}`);
  const maps = {};
  for (const [apiKey, name] of MAP_KEYS) {
    const res = pickRes(files[apiKey], entry.res);
    const url = res?.jpg?.url;
    if (!url) continue; // not every texture has every map
    const dest = `${OUT}/textures/${id}/${name}.jpg`;
    await downloadFile(url, dest);
    maps[name] = dest.replace(/^public/, '');
  }
  if (!maps.diffuse) {
    summary.failed.push(`${entry.logical}: ${id} has no diffuse map`);
    return;
  }
  manifest[entry.logical] = { id, type: 'texture', maps };
}

async function fetchModel(entry, manifest, taken) {
  const id = await resolveId(entry, 'models', taken);
  if (!id) {
    summary.failed.push(`${entry.logical}: no model resolved`);
    return;
  }
  taken.add(id);
  console.log(`  ${entry.logical} -> ${id}`);
  const files = await fetchJson(`${API}/files/${id}`);
  const res = pickRes(files.gltf, entry.res);
  if (!res) {
    summary.failed.push(`${entry.logical}: ${id} has no gltf`);
    return;
  }
  // Prefer .glb (single file) when offered; otherwise .gltf + all includes.
  const fmt = res.glb ?? res.gltf;
  const fmtName = res.glb ? 'glb' : 'gltf';
  const dir = `${OUT}/models/${id}`;
  const mainDest = `${dir}/${path.basename(new URL(fmt.url).pathname)}`;
  await downloadFile(fmt.url, mainDest);
  if (fmtName === 'gltf' && fmt.include) {
    for (const [rel, file] of Object.entries(fmt.include)) {
      await downloadFile(file.url, `${dir}/${rel}`); // preserve relative paths
    }
  }
  manifest[entry.logical] = { id, type: 'model', path: mainDest.replace(/^public/, '') };
}

// ---------------------------------------------------------------------------
// Kenney fetcher — no JSON API; scrape the .zip link from the asset page.
// ---------------------------------------------------------------------------

async function fetchKenney(entry, manifest) {
  const pageUrl = `https://kenney.nl/assets/${entry.slug}`;
  const dir = `${OUT}/kenney/${entry.slug}`;
  if (await exists(`${dir}/.fetched`)) {
    summary.skipped.push(dir);
    manifest[entry.logical] = { type: 'kenney', dir: dir.replace(/^public/, '') };
    return;
  }
  const res = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
  if (res.status === 404) {
    summary.failed.push(`kenney ${entry.slug}: page 404 (skipped)`);
    return;
  }
  if (!res.ok) throw new Error(`${res.status} for ${pageUrl}`);
  const html = await res.text();
  const m = html.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^'">\s]+\.zip/);
  if (!m) {
    summary.manual.push(`Could not find zip link on ${pageUrl} — download manually into ${dir}/`);
    return;
  }
  const zipDest = `${dir}/_pack.zip`;
  await downloadFile(m[0], zipDest);
  await execFileAsync('unzip', ['-oq', zipDest, '-d', dir]);
  await rm(zipDest);
  await writeFile(`${dir}/.fetched`, new Date().toISOString());
  manifest[entry.logical] = { type: 'kenney', dir: dir.replace(/^public/, '') };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Fetching ${FULL ? 'FULL warehouse wishlist' : 'minimal Phase-0 set (use --full for everything)'}\n`);
  await mkdir(OUT, { recursive: true });

  // Merge into an existing manifest so minimal + full runs accumulate.
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8'));
  } catch {
    /* first run */
  }

  const want = (e) => FULL || e.minimal;
  const taken = new Set();

  console.log('— HDRIs —');
  for (const e of HDRIS.filter(want)) {
    await fetchHdri(e, manifest, taken).catch((err) => summary.failed.push(`${e.logical}: ${err.message}`));
  }

  console.log('— Textures —');
  const takenTex = new Set();
  for (const e of TEXTURES.filter(want)) {
    await fetchTexture(e, manifest, takenTex).catch((err) => summary.failed.push(`${e.logical}: ${err.message}`));
  }

  console.log('— Models —');
  const takenModels = new Set();
  for (const e of MODELS.filter(want)) {
    await fetchModel(e, manifest, takenModels).catch((err) => summary.failed.push(`${e.logical}: ${err.message}`));
  }

  console.log('— Kenney packs —');
  for (const e of KENNEY.filter(want)) {
    await fetchKenney(e, manifest).catch((err) => summary.failed.push(`kenney ${e.slug}: ${err.message}`));
  }

  await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${OUT}/manifest.json with ${Object.keys(manifest).length} logical entries.`);

  console.log(`\nSummary: ${summary.fetched.length} fetched, ${summary.skipped.length} skipped (already present), ${summary.failed.length} failed.`);
  for (const f of summary.failed) console.log(`  ✗ ${f}`);
  for (const m of summary.manual) console.log(`  ⚠ MANUAL: ${m}`);
  if (summary.failed.length && !summary.fetched.length && !summary.skipped.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
