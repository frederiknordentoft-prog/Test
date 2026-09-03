/* Nova skin: wires the cosmic art + starfield into the shared game (app.js reads window.SlotSkin). */
(function () {
  'use strict';
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sf = new Starfield(document.getElementById('starfield'), { reducedMotion: reduced });
  window.SlotSkin = {
    name: 'nova',
    art: SlotArtNova,
    particles: 'shards',
    fxColors: ['#ffe14d', '#2ee59d', '#ff8c2a', '#3b8bff', '#b04cff', '#ff4fa3', '#7df9ff'],
    onSpinStart() { sf.setWarp(1); },
    onSpinEnd() { sf.setWarp(0); },
    onReelStop(i, column) { if (column && column.includes('WILD')) sf.flash(0.5); },
    onWin(tier) { sf.flash(tier === 'win' ? 0.6 : tier === 'big' ? 1 : 1.4); },
    onFreeEnter() { sf.setMode('free'); sf.flash(1.2); },
    onFreeExit() { sf.setMode('base'); },
    starfield: sf,
  };
  // Re-bake symbols once the display font is available (BAR / 7 use it).
  if (document.fonts && document.fonts.load) {
    document.fonts.load('900 20px Rubik').then(() => {
      SlotArtNova.clearCache();
      if (window.Objekt) { window.Objekt.engine.symbolCache.clear(); window.Objekt.engine._needsDraw = true; window.Objekt.renderStaticArt && window.Objekt.renderStaticArt(); }
    }).catch(() => {});
  }
})();
