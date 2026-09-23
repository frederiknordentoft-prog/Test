// "Polar Night" base bed: the embedded MP3 section (see polarLoop.ts) decoded and folded into an exact
// `bars`-bar loop on the base grid, so it plays like any other base stem (looping AudioBufferSourceNode,
// sample-locked to base1–base4).
//
// Embedding: the artifact CSP forbids fetch/data: loads, so the file is inlined as a data URI string (Vite
// `?inline`, via import.meta.glob so a missing file only disables the bed) and turned into bytes with atob.
// Decoding runs on an OfflineAudioContext at the stem rate (hw/2: the recording has < 0.001 % of its energy
// above 11 kHz; bands above 10 kHz sit ≥ 47 dB below the loudest), so only the ~51 s cut is ever decoded.
import { POLAR_LOOP } from './polarLoop.ts';
import { barFrames, BASE_BPM } from './music.ts';
import { dbToGain, newBuffer } from './dsp.ts';

export const POLAR_ID = 'polar';
/** Stem-rate policy (same as base0): hw/2 normally, hw/4 on lite devices, never below 11 kHz. */
export const POLAR_DIV = 2;
export const POLAR_MIN_RATE = 11000;

const files = import.meta.glob('./assets/polar-night-loop.mp3', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const DATA_URI: string | undefined = Object.values(files)[0];
/** True when the MP3 was bundled (otherwise the engine keeps the procedural bed). */
export const polarAvailable = (): boolean => !!DATA_URI;

function bytes(uri: string): ArrayBuffer {
  const bin = atob(uri.slice(uri.indexOf(',') + 1));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

/** decodeAudioData, callback form too (older Safari has no promise form). */
function decode(ctx: BaseAudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((res, rej) => {
    try {
      const p = ctx.decodeAudioData(ab, res, rej) as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') p.then(res, rej);
    } catch (e) { rej(e); }
  });
}

/**
 * Decode the cut at `sr` = hw/div and fold it into the loop: frames [S, S+L) of the recording with the
 * last `xfade` seconds crossfaded (equal power) into the pre-roll frames [S−X, S), where S = loopStart and
 * L = bars × barFrames(BASE_BPM) — exactly the base grid, whatever the rate. The level trim is baked in.
 */
export async function decodePolar(hw: number, div: number): Promise<AudioBuffer> {
  if (!DATA_URI) throw new Error('polar bed not bundled');
  const sr = hw / div;
  const dec = await decode(new OfflineAudioContext(2, 1, sr), bytes(DATA_URI));
  // Chromium decodes every frame (reference for loopStart). A decoder that drops the reservoir-starved first
  // frame or trims priming returns fewer frames; assume that happened at the start (bounded to one frame
  // + decoder delay) so the downbeat stays on the grid.
  const expect = Math.round((POLAR_LOOP.decodedFrames * sr) / POLAR_LOOP.decodedRate);
  const lim = Math.round((1700 * sr) / POLAR_LOOP.decodedRate);
  const shift = Math.max(-lim, Math.min(lim, expect - dec.length));
  const L = POLAR_LOOP.bars * barFrames(BASE_BPM, sr, div);
  const S = Math.round(POLAR_LOOP.loopStart * sr) - shift;
  const X = Math.round(POLAR_LOOP.xfade * sr);
  if (S - X < 0 || S + L > dec.length) throw new Error(`polar cut too short (${dec.length} frames)`);
  const g = dbToGain(POLAR_LOOP.gainDb);
  const out = newBuffer(2, L, sr);
  const k = Math.PI / 2 / X;
  for (let c = 0; c < 2; c++) {
    const src = dec.getChannelData(Math.min(c, dec.numberOfChannels - 1)), d = out.getChannelData(c);
    const body = L - X;
    for (let j = 0; j < body; j++) d[j] = src[S + j] * g;
    for (let j = body, u = 0.5; j < L; j++, u++) d[j] = (src[S + j] * Math.cos(u * k) + src[S + j - L] * Math.sin(u * k)) * g;
  }
  return out;
}
