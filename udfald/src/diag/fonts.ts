/**
 * Fonts are self-hosted (OFL, via @fontsource) and loaded with the FontFace API, so we can tell
 * whether the artifact CSP allows the page's own font files. If not, fall back to data: URIs.
 */
import flexUrl from '@fontsource-variable/roboto-flex/files/roboto-flex-latin-opsz-normal.woff2?url';
import tightUrl from '@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2?url';
import serifUrl from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import { setCheck } from './store';

const FACES = [
  { family: 'UDF Flex', url: flexUrl, desc: { weight: '100 1000' } as FontFaceDescriptors, inline: () => import('@fontsource-variable/roboto-flex/files/roboto-flex-latin-opsz-normal.woff2?inline') },
  { family: 'UDF Tight', url: tightUrl, desc: { weight: '100 900' } as FontFaceDescriptors, inline: () => import('@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2?inline') },
  { family: 'UDF Serif', url: serifUrl, desc: { style: 'italic', weight: '400' } as FontFaceDescriptors, inline: () => import('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?inline') },
];

async function loadOne(face: (typeof FACES)[number]): Promise<'egen fil' | 'data-URI' | 'fejl'> {
  try {
    const ff = new FontFace(face.family, `url(${face.url}) format('woff2')`, face.desc);
    document.fonts.add(ff); // add before load, so 'loadingdone' fires for canvas redraws
    await ff.load();
    return 'egen fil';
  } catch {
    try {
      const mod = await face.inline();
      const ff = new FontFace(face.family, `url(${mod.default}) format('woff2')`, face.desc);
      document.fonts.add(ff);
      await ff.load();
      return 'data-URI';
    } catch {
      return 'fejl';
    }
  }
}

let resolveReady: () => void = () => {};
/** Resolves when all fonts have settled (loaded or failed). Canvas renderers redraw on it. */
export const fontsReady: Promise<void> = new Promise((r) => {
  resolveReady = r;
});

export async function loadFonts(): Promise<void> {
  setCheck('fonts', { status: 'afventer', detail: 'Indlæser …' });
  if (typeof FontFace === 'undefined' || !document.fonts) {
    setCheck('fonts', { status: 'advarsel', detail: 'FontFace API mangler; systemfonte bruges' });
    resolveReady();
    return;
  }
  const t0 = performance.now();
  const res = await Promise.all(FACES.map(loadOne));
  const byFamily = Object.fromEntries(FACES.map((f, i) => [f.family, res[i]]));
  const bad = res.filter((r) => r === 'fejl').length;
  const viaData = res.filter((r) => r === 'data-URI').length;
  setCheck('fonts', {
    status: bad ? 'fejl' : viaData ? 'advarsel' : 'ok',
    detail: bad ? `${bad} font(e) kunne ikke indlæses` : viaData ? 'Egne filer blokeret, data-URI virker' : 'Egne fontfiler virker',
    data: { ...byFamily, ms: Math.round(performance.now() - t0) },
  });
  resolveReady();
}
