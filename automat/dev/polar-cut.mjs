// Re-cut the Polar Night bed from the original: node dev/polar-cut.mjs [firstFrame endFrame] [in] [out]
// Copies MPEG-1 Layer III frames [firstFrame, endFrame) verbatim (audio frames counted after the Xing/Info
// frame; ID3 and Xing dropped) — no re-encode. Defaults reproduce src/audio/assets/polar-night-loop.mp3.
// After a re-cut, re-measure loopStart/decodedFrames (src/audio/polarLoop.ts): decode both files in
// Chromium and align the cut against the full decode (Chromium trims 1105 samples of LAME delay from the
// full file and nothing from the cut, so cut sample 0 = original sample firstFrame·1152 − 1105).
import { readFileSync, writeFileSync } from 'node:fs';

const [f0 = 3767, f1 = 5902] = process.argv.slice(2, 4).map(Number);
const inp = process.argv[4] ?? 'assets-src/polar-night.mp3';
const out = process.argv[5] ?? 'src/audio/assets/polar-night-loop.mp3';
const b = readFileSync(inp);
const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const RATE = [44100, 48000, 32000];
let i = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 ? 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127)) + (b[5] & 16 ? 10 : 0) : 0;
const frames = [];
while (i + 4 <= b.length) {
  const ok = b[i] === 0xff && (b[i + 1] & 0xfe) === 0xfa; // sync, MPEG-1, Layer III
  const bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3;
  if (!ok || bri === 0 || bri === 15 || sri === 3) throw new Error(`no MPEG-1 L3 frame at byte ${i}`);
  const len = Math.floor((144 * KBPS[bri] * 1000) / RATE[sri]) + ((b[i + 2] >> 1) & 1);
  frames.push([i, len]);
  i += len;
}
const side = (b[frames[0][0] + 3] >> 6) === 3 ? 17 : 32, x = frames[0][0] + 4 + (b[frames[0][0] + 1] & 1 ? 0 : 2) + side;
const tag = b.toString('latin1', x, x + 4);
const audio = tag === 'Xing' || tag === 'Info' ? frames.slice(1) : frames;
const data = Buffer.concat(audio.slice(f0, f1).map(([at, len]) => b.subarray(at, at + len)));
writeFileSync(out, data);
console.log(`${out}: frames [${f0}, ${f1}) of ${audio.length} (${tag === 'Xing' || tag === 'Info' ? tag + ' frame dropped' : 'no Xing'}), ${data.length} bytes, ${((f1 - f0) * 1152 / 48000).toFixed(3)} s @ 48 kHz`);
