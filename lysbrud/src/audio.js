/* LYSBRUD — lydmotor. Alt syntetiseres i WebAudio; ingen lydfiler.
   Paletten er kold og krystallinsk: glas, is, resonant metal og en dyb
   reaktorbrummen under det hele. Alt musikalsk ligger i én mol-pentaton
   skala, så overlappende lyde aldrig kan skurre mod hinanden.

   Tre regler holder modulet i live gennem en lang autospilsession:
   1) AudioContext bygges først i unlock() — aldrig ved import.
   2) Hver stemme stopper OG afkobler sine noder via 'ended'.
   3) Hele den offentlige flade er indpakket, så manglende eller fejlende
      lyd degraderer til tavse no-ops i stedet for at vælte spillet. */

/* ---------------------------------------------------------------- skala */

/** Mol-pentaton i halvtoner. Ingen halvtoneafstande = ingen skurren. */
const PENTA = [0, 3, 5, 7, 10];
const ROOT = 220;                       // A3

/** Skalatrin → frekvens. Negative trin går under grundtonen. */
function deg(n) {
  const i = Math.floor(n / PENTA.length);
  const s = PENTA[((n % 5) + 5) % 5] + 12 * i;
  return ROOT * Math.pow(2, s / 12);
}

/** Let inharmoniske partialer = glasklokke. */
const GLASS = [1, 2.01, 2.99, 4.21];
/** Kraftigt inharmoniske partialer = slået metal. */
const METAL = [1, 2.76, 5.40, 8.93];

const MASTER_GAIN = 0.62;               // kontraktens loft er 0.7
const MAX_VOICES = 96;                  // hård polyfoni-grænse
const NOISE_SECONDS = 2;

/* Egen lille generator: config-projektet forbyder Math.random, og
   lydens variation skal alligevel ikke røre spillets determinisme. */
let rs = 0x9e3779b9;
function rand() {
  rs ^= rs << 13; rs >>>= 0;
  rs ^= rs >>> 17;
  rs ^= rs << 5;  rs >>>= 0;
  return rs / 4294967296;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* ------------------------------------------------------------- fabrikken */

export function createAudio() {
  let ctx = null;
  let master = null, comp = null;
  let send = null, delay = null, damp = null, feedback = null, wet = null;
  let noiseBuf = null;
  let hasPan = false;
  let dead = false;                     // WebAudio utilgængelig → alt tier
  let primed = false;
  let muted = false;
  let voices = 0;
  let loop = null;                      // den kørende spin-whirr
  let lastTick = -1;
  const swarm = { at: -1, n: 0 };       // splintringer kommer i sværme

  /* ------------------------------------------------------------ opsætning */

  function build() {
    if (ctx || dead) return;
    const g = typeof globalThis !== 'undefined' ? globalThis : null;
    const AC = g && (g.AudioContext || g.webkitAudioContext);
    if (!AC) { dead = true; return; }
    try {
      ctx = new AC();
    } catch (e) { dead = true; ctx = null; return; }

    master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : MASTER_GAIN;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 26;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    master.connect(comp);
    comp.connect(ctx.destination);

    /* Shimmer-send: kort feedback-delay med højpasset, dæmpet hale.
       Giver glas-efterklang uden impulsfil. */
    send = ctx.createGain();     send.gain.value = 1;
    delay = ctx.createDelay(1);  delay.delayTime.value = 0.185;
    damp = ctx.createBiquadFilter(); damp.type = 'highpass'; damp.frequency.value = 950;
    feedback = ctx.createGain(); feedback.gain.value = 0.36;
    wet = ctx.createGain();      wet.gain.value = 0.32;
    send.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);            // < 1 = konvergerer altid
    damp.connect(wet);
    wet.connect(master);

    hasPan = typeof ctx.createStereoPanner === 'function';
    noiseBuf = makeNoise();
  }

  function makeNoise() {
    const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
    return buf;
  }

  function ready() { return !dead && !!ctx && ctx.state === 'running'; }
  function at(when) { return ctx.currentTime + 0.005 + Math.max(0, when || 0); }

  /* --------------------------------------------------------- stemmestyring */

  function claim() {
    if (voices >= MAX_VOICES) return false;
    voices++;
    return true;
  }

  /** Frigiv stemmen og riv dens noder ned. Kaldes fra 'ended'. */
  function release(nodes) {
    voices = Math.max(0, voices - 1);
    for (let k = 0; k < nodes.length; k++) {
      try { nodes[k].disconnect(); } catch (e) { /* allerede afkoblet */ }
    }
  }

  /** Angreb → (hold) → eksponentielt henfald, med hård nul til sidst. */
  function env(param, t0, attack, hold, dur, peak) {
    const p = Math.max(0.0002, peak);
    const a = clamp(attack, 0.001, dur * 0.8);
    const h = Math.max(0, hold);
    const end = Math.max(t0 + a + h + 0.02, t0 + dur);
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(p, t0 + a);
    if (h > 0) param.setValueAtTime(p, t0 + a + h);
    param.exponentialRampToValueAtTime(0.0001, end);
    param.setValueAtTime(0, end + 0.004);
    return end;
  }

  /* ------------------------------------------------------- grundstemmer
     Alle spillyde nedenfor er skrevet i disse tre + tre gestus-hjælpere.
     Ingen oscillator-boilerplate gentages.                              */

  /** Ren tone. {freq,type,dur,attack,hold,decay,gain,detune,bend,when,send,pan} */
  function tone(o) {
    if (!ctx || !claim()) return;
    const dur = Math.max(0.03, o.dur == null ? 0.4 : o.dur);
    const t0 = at(o.when);
    const f = Math.max(20, o.freq || ROOT);

    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
    if (o.bend && o.bend > 0 && o.bend !== 1) {
      osc.frequency.exponentialRampToValueAtTime(
        clamp(f * o.bend, 20, 18000), t0 + dur * clamp(o.bendTime || 1, 0.05, 1));
    }

    const g = ctx.createGain();
    // decay er et alias for dur når kalderen tænker i henfald.
    const end = env(g.gain, t0, o.attack == null ? 0.006 : o.attack,
      o.hold || 0, o.decay == null ? dur : o.decay, o.gain == null ? 0.14 : o.gain);
    osc.connect(g);

    const tail = [osc, g];
    if (o.pan && hasPan) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(o.pan, -1, 1);
      g.connect(p); p.connect(master);
      tail.push(p);
    } else {
      g.connect(master);
    }
    if (o.send) {
      const s = ctx.createGain();
      s.gain.value = clamp(o.send, 0, 1);
      g.connect(s); s.connect(send);
      tail.push(s);
    }

    osc.onended = () => release(tail);
    osc.start(t0);
    osc.stop(end + 0.03);
  }

  /** Filtreret støj. {dur,filterType,freq,q,gain,attack,hold,sweep,when,send,pan} */
  function noise(o) {
    if (!ctx || !noiseBuf || !claim()) return;
    const dur = Math.max(0.02, o.dur == null ? 0.2 : o.dur);
    const t0 = at(o.when);
    const f = clamp(o.freq == null ? 1200 : o.freq, 20, 18000);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    if (dur + 0.1 >= NOISE_SECONDS) src.loop = true;
    const offset = src.loop ? 0 : rand() * (NOISE_SECONDS - dur - 0.08);

    const flt = ctx.createBiquadFilter();
    flt.type = o.filterType || 'bandpass';
    flt.frequency.setValueAtTime(f, t0);
    if (o.sweep && o.sweep > 0 && o.sweep !== 1) {
      flt.frequency.exponentialRampToValueAtTime(clamp(f * o.sweep, 20, 18000), t0 + dur);
    }
    flt.Q.value = o.q == null ? 1 : o.q;

    const g = ctx.createGain();
    const end = env(g.gain, t0, o.attack == null ? 0.004 : o.attack,
      o.hold || 0, dur, o.gain == null ? 0.08 : o.gain);

    src.connect(flt); flt.connect(g);

    const tail = [src, flt, g];
    if (o.pan && hasPan) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(o.pan, -1, 1);
      g.connect(p); p.connect(master);
      tail.push(p);
    } else {
      g.connect(master);
    }
    if (o.send) {
      const s = ctx.createGain();
      s.gain.value = clamp(o.send, 0, 1);
      g.connect(s); s.connect(send);
      tail.push(s);
    }

    src.onended = () => release(tail);
    src.start(t0, Math.max(0, offset));
    src.stop(end + 0.03);
  }

  /** Akkord/klynge på skalatrin. {degrees,base,spread,fall,…tone-opts} */
  function chord(o) {
    const list = o.degrees || [0];
    const base = o.base || 0;
    const gain = o.gain == null ? 0.10 : o.gain;
    const fall = o.fall == null ? 1 : o.fall;
    for (let k = 0; k < list.length; k++) {
      tone({
        freq: deg(list[k] + base),
        type: o.type || 'sine',
        dur: o.dur, attack: o.attack, hold: o.hold, bend: o.bend,
        send: o.send, pan: o.pan,
        detune: k % 2 ? 4 : -4,          // minimal spredning = bredde
        gain: gain * Math.pow(fall, k),
        when: (o.when || 0) + k * (o.spread || 0),
      });
    }
  }

  /* ------------------------------------------------------------- gestus */

  /** Klokke: stak af partialer med faldende længde og styrke. */
  function bell(o) {
    const parts = (o.partials || GLASS).slice(0, o.n || 4);
    const gain = o.gain == null ? 0.14 : o.gain;
    const dur = o.dur == null ? 0.9 : o.dur;
    for (let k = 0; k < parts.length; k++) {
      tone({
        freq: o.freq * parts[k],
        type: 'sine',
        dur: dur * Math.pow(0.6, k),
        attack: 0.003,
        gain: gain * Math.pow(0.46, k),
        when: o.when || 0,
        detune: k * 3,
        send: o.send == null ? 0.35 : o.send,
        pan: o.pan || 0,
      });
    }
  }

  /** Opadgående energiswell — bruges foran de store gevinster. */
  function riser(o) {
    const dur = o.dur || 1;
    noise({ dur: dur, filterType: 'bandpass', freq: 240, q: 3.4,
      gain: o.gain == null ? 0.09 : o.gain, attack: dur * 0.78, sweep: 16,
      when: o.when, send: 0.45 });
    tone({ freq: 88, type: 'sawtooth', dur: dur, attack: dur * 0.78,
      gain: (o.gain == null ? 0.09 : o.gain) * 0.55, bend: 2.4, when: o.when });
  }

  /** Dybt metalslag med krop. */
  function gong(o) {
    const gain = o.gain == null ? 0.13 : o.gain;
    bell({ freq: o.freq, dur: o.dur || 2.4, gain: gain, when: o.when,
      send: 0.6, partials: METAL, n: 4 });
    tone({ freq: o.freq / 2, type: 'sine', dur: (o.dur || 2.4) * 0.8,
      attack: 0.012, gain: gain * 0.95, when: o.when, bend: 0.985 });
    noise({ dur: 0.5, filterType: 'lowpass', freq: 900, q: 1,
      gain: gain * 0.5, attack: 0.004, sweep: 0.25, when: o.when });
  }

  /** Liggende flade. */
  function pad(o) {
    chord({ degrees: o.degrees || [0, 2, 4], base: o.base || 0, type: 'triangle',
      dur: o.dur || 2.2, gain: o.gain == null ? 0.065 : o.gain,
      attack: 0.35, spread: 0.02, fall: 0.86, when: o.when, send: 0.5 });
  }

  /** Arpeggio af klokker op (eller ned) ad skalaen. */
  function arp(degrees, o) {
    const opt = o || {};
    for (let k = 0; k < degrees.length; k++) {
      bell({
        freq: deg(degrees[k]),
        dur: opt.dur == null ? 0.9 : opt.dur,
        gain: opt.gain == null ? 0.10 : opt.gain,
        when: (opt.when || 0) + k * (opt.step == null ? 0.1 : opt.step),
        send: opt.send == null ? 0.5 : opt.send,
        n: opt.n || 3,
        pan: ((k % 2) ? 0.35 : -0.35),
      });
    }
  }

  /** Gnistsky: korte høje pentatone prikker spredt i tid og bredde. */
  function sparkles(o) {
    const n = (o && o.n) || 8;
    const span = (o && o.span) || 1.2;
    for (let k = 0; k < n; k++) {
      tone({
        freq: deg(12 + Math.floor(rand() * 8)),
        type: 'sine',
        dur: 0.3 + rand() * 0.4,
        attack: 0.002,
        gain: 0.034,
        when: ((o && o.when) || 0) + rand() * span,
        send: 0.6,
        pan: rand() * 1.6 - 0.8,
      });
    }
  }

  /* --------------------------------------------------------- spin-whirr */

  function startLoop() {
    if (loop || !ctx || !noiseBuf) return;
    const t0 = at(0);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 240;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 780; bp.Q.value = 1.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.3);

    // Langsom LFO svinger filteret — hjulets hvæsen "ånder".
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.34;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 420;
    lfo.connect(lfoAmt); lfoAmt.connect(bp.frequency);

    // Dyb reaktorbrummen under hvæsenet.
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 55;
    const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 190; humF.Q.value = 5;
    const humG = ctx.createGain();
    humG.gain.setValueAtTime(0.0001, t0);
    humG.gain.exponentialRampToValueAtTime(0.05, t0 + 0.45);
    const hlfo = ctx.createOscillator(); hlfo.type = 'sine'; hlfo.frequency.value = 0.21;
    const hlfoAmt = ctx.createGain(); hlfoAmt.gain.value = 5;
    hlfo.connect(hlfoAmt); hlfoAmt.connect(hum.frequency);

    const sg = ctx.createGain(); sg.gain.value = 0.16;

    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master);
    g.connect(sg); sg.connect(send);
    hum.connect(humF); humF.connect(humG); humG.connect(master);

    src.start(t0); lfo.start(t0); hum.start(t0); hlfo.start(t0);

    loop = {
      nodes: [src, hp, bp, g, sg, lfo, lfoAmt, hum, humF, humG, hlfo, hlfoAmt],
      gains: [g, humG],
      srcs: [src, lfo, hum, hlfo],
    };
  }

  function stopLoop() {
    if (!loop) return;
    const L = loop;
    loop = null;                        // frigiv pladsen straks: on/off/on leaker ikke
    const t0 = ctx ? ctx.currentTime : 0;
    for (let k = 0; k < L.gains.length; k++) {
      const p = L.gains[k].gain;
      try {
        p.cancelScheduledValues(t0);
        p.setValueAtTime(Math.max(0.0001, p.value), t0);
        p.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      } catch (e) { /* konteksten kan være lukket */ }
    }
    const end = t0 + 0.26;
    L.srcs[0].onended = () => {
      for (let k = 0; k < L.nodes.length; k++) {
        try { L.nodes[k].disconnect(); } catch (e) { /* allerede afkoblet */ }
      }
    };
    for (let k = 0; k < L.srcs.length; k++) {
      try { L.srcs[k].stop(end); } catch (e) { /* allerede stoppet */ }
    }
  }

  /* ---------------------------------------------------------- spillyde */

  function spinStart() {
    noise({ dur: 0.6, filterType: 'bandpass', freq: 300, q: 1.1,
      gain: 0.10, attack: 0.10, sweep: 5.5, send: 0.25 });
    tone({ freq: deg(-5), type: 'triangle', dur: 0.55, attack: 0.02,
      gain: 0.11, bend: 1.5 });
    bell({ freq: deg(7), dur: 0.5, gain: 0.06, send: 0.45 });
  }

  /** Dæmpet metalklunk, en helttone lavere pr. ring. */
  function ringStop(index) {
    const k = clamp(Math.round(index) || 0, 0, 8);
    const f = 430 * Math.pow(2, -k * 2 / 12);
    bell({ freq: f, dur: 0.34, gain: 0.13, send: 0.22, partials: METAL, n: 4 });
    noise({ dur: 0.13, filterType: 'lowpass', freq: 280, q: 1.2,
      gain: 0.12, attack: 0.002, sweep: 0.35 });
    noise({ dur: 0.06, filterType: 'highpass', freq: 2800, q: 0.7,
      gain: 0.045, attack: 0.001 });
  }

  /** Kaldes én gang pr. splintret celle — kan komme 30 gange på én frame. */
  function shatter(tier) {
    const t = clamp(Math.round(tier) || 0, 0, 8);
    const now = ctx.currentTime;
    if (now - swarm.at > 0.08) { swarm.at = now; swarm.n = 0; }
    swarm.n++;
    if (swarm.n > 5) return;            // sværmen høres, hver splint gør ikke
    const duck = 1 / (1 + swarm.n * 0.55);
    const when = (swarm.n - 1) * 0.014 + rand() * 0.012;
    const f = 1500 * Math.pow(2, t / 12) * (0.88 + rand() * 0.28);
    const pan = rand() * 1.4 - 0.7;
    noise({ dur: 0.17, filterType: 'highpass', freq: 2400, q: 0.8,
      gain: 0.085 * duck, attack: 0.001, sweep: 1.8, when: when, send: 0.3, pan: pan });
    tone({ freq: f, type: 'triangle', dur: 0.12, attack: 0.001,
      gain: 0.05 * duck, bend: 0.72, when: when, send: 0.4, pan: pan });
    tone({ freq: f * 1.98, type: 'sine', dur: 0.09, attack: 0.001,
      gain: 0.028 * duck, when: when + 0.012, send: 0.45, pan: pan });
  }

  /** Stigende pentaton klokke, ét trin pr. kaskade, med loft. */
  function cascade(n) {
    const k = clamp(Math.round(n) || 0, 0, 7);
    bell({ freq: deg(7 + k), dur: 1 + k * 0.07, gain: 0.115, send: 0.55, n: 4 });
    tone({ freq: deg(k - 10), type: 'sine', dur: 0.5, attack: 0.01, gain: 0.07 });
    noise({ dur: 0.3, filterType: 'highpass', freq: 3400, q: 0.6,
      gain: 0.035, attack: 0.005, sweep: 2, send: 0.5 });
  }

  /** Reaktoren trapper op: dyb swell + ladningssus + pentaton markering. */
  function reactor(step) {
    const k = clamp(Math.round(step) || 0, 0, 6);
    tone({ freq: 46 * Math.pow(2, k / 24), type: 'sine', dur: 0.8,
      attack: 0.06, gain: 0.16, bend: 1.35 });
    noise({ dur: 0.62, filterType: 'bandpass', freq: 520, q: 3.2,
      gain: 0.08, attack: 0.2, sweep: 4.5, send: 0.35 });
    chord({ degrees: [0, 2], base: 5 + k, type: 'triangle', dur: 0.7,
      attack: 0.01, gain: 0.075, spread: 0.05, send: 0.45 });
  }

  /* Gevinstfanfarer. Hvert trin er en NY gestus, ikke bare mere lydstyrke:
     small = ét lille arpeggio · big = arpeggio + tonika · mega = riser og
     gong · epic = flade og svar-arpeggio · lysbrud = alt, plus gnistsky. */
  function win(tier) {
    if (tier === 'lysbrud') {
      riser({ dur: 1.6, gain: 0.115 });
      gong({ freq: deg(-5), dur: 3.6, gain: 0.15, when: 1.55 });
      pad({ base: 0, degrees: [0, 2, 4, 5, 7], dur: 3.4, gain: 0.07, when: 1.6 });
      arp([5, 7, 9, 10, 12, 14, 15, 17], { when: 1.64, step: 0.115, dur: 1.5, gain: 0.10 });
      sparkles({ n: 16, span: 2.2, when: 1.9 });
      return;
    }
    if (tier === 'epic') {
      riser({ dur: 1.05, gain: 0.10 });
      gong({ freq: deg(-3), dur: 2.6, gain: 0.13, when: 1 });
      pad({ base: 0, degrees: [0, 2, 4, 7], dur: 2.4, gain: 0.065, when: 1.04 });
      arp([7, 9, 11, 12, 14, 16], { when: 1.08, step: 0.1, dur: 1.2, gain: 0.10 });
      sparkles({ n: 9, span: 1.4, when: 1.3 });
      return;
    }
    if (tier === 'mega') {
      riser({ dur: 0.72, gain: 0.09 });
      gong({ freq: deg(-2), dur: 1.9, gain: 0.12, when: 0.68 });
      pad({ base: 0, degrees: [0, 4], dur: 1.6, gain: 0.055, when: 0.72 });
      arp([5, 7, 9, 12, 14, 16], { when: 0.74, step: 0.095, dur: 1, gain: 0.10 });
      return;
    }
    if (tier === 'big') {
      arp([5, 7, 9, 11, 12], { step: 0.1, dur: 0.9, gain: 0.10 });
      tone({ freq: deg(-5), type: 'triangle', dur: 1.1, attack: 0.02, gain: 0.11 });
      noise({ dur: 0.45, filterType: 'highpass', freq: 3000, q: 0.7,
        gain: 0.04, attack: 0.02, sweep: 2.2, send: 0.5 });
      return;
    }
    // 'small' og alt ukendt
    arp([7, 9, 12], { step: 0.075, dur: 0.6, gain: 0.085, n: 2 });
    tone({ freq: deg(0), type: 'sine', dur: 0.5, attack: 0.01, gain: 0.05, send: 0.3 });
  }

  /** Prismeladning 1..5. Den femte åbner bonussen og er tydeligt anderledes. */
  function prismCharge(n) {
    const k = clamp(Math.round(n) || 1, 1, 5);
    if (k >= 5) {
      noise({ dur: 0.95, filterType: 'bandpass', freq: 380, q: 2.6,
        gain: 0.10, attack: 0.38, sweep: 14, send: 0.5 });
      chord({ degrees: [0, 2, 4, 5], base: 7, dur: 1.8, attack: 0.01,
        gain: 0.10, spread: 0.06, send: 0.6 });
      bell({ freq: deg(14), dur: 2.2, gain: 0.10, when: 0.2, send: 0.7, n: 4 });
      tone({ freq: deg(-5), type: 'triangle', dur: 1.7, attack: 0.03, gain: 0.13 });
      sparkles({ n: 8, span: 1.1, when: 0.3 });
      return;
    }
    bell({ freq: deg(9 + k * 2), dur: 0.85, gain: 0.10, send: 0.55, n: 3 });
    tone({ freq: deg(2 + k), type: 'sine', dur: 0.26, attack: 0.002,
      gain: 0.05, send: 0.3 });
    noise({ dur: 0.22, filterType: 'highpass', freq: 4200, q: 0.6,
      gain: 0.03, attack: 0.006, sweep: 1.6, send: 0.5 });
  }

  function bonusStart() {
    riser({ dur: 1.35, gain: 0.10 });
    gong({ freq: deg(-5), dur: 2.8, gain: 0.13, when: 1.3 });
    pad({ base: 0, degrees: [0, 2, 4, 7], dur: 2.6, gain: 0.07, when: 1.34 });
    arp([7, 9, 12, 14, 16], { when: 1.38, step: 0.12, dur: 1.2, gain: 0.095 });
    sparkles({ n: 10, span: 1.6, when: 1.45 });
  }

  function bonusEnd() {
    arp([14, 12, 9, 7], { step: 0.13, dur: 1, gain: 0.085 });
    pad({ base: 0, degrees: [0, 4], dur: 2, gain: 0.06, when: 0.12 });
    tone({ freq: deg(-5), type: 'sine', dur: 1.8, attack: 0.05, gain: 0.10 });
  }

  /** Tælle-tik. Kan kaldes hver frame — derfor egen spærre. */
  function tick() {
    const now = ctx.currentTime;
    if (now - lastTick < 0.03) return;
    lastTick = now;
    tone({ freq: deg(16), type: 'sine', dur: 0.05, attack: 0.001,
      gain: 0.028, send: 0.15 });
  }

  function click() {
    noise({ dur: 0.05, filterType: 'highpass', freq: 1800, q: 0.9,
      gain: 0.05, attack: 0.001, sweep: 0.6 });
    tone({ freq: deg(10), type: 'triangle', dur: 0.08, attack: 0.001,
      gain: 0.05, bend: 0.82, send: 0.2 });
  }

  /* ------------------------------------------------------- offentlig flade
     voice(): kræver kørende kontekst og lyd til. raw(): kun kontekst.
     Begge sluger enhver fejl — spillet må aldrig knække på lyd.          */

  function voice(fn) {
    return function (a) {
      try { if (!ready() || muted) return; fn(a); } catch (e) { /* tavs */ }
    };
  }

  function raw(fn) {
    return function (a) {
      try { if (dead || !ctx) return; fn(a); } catch (e) { /* tavs */ }
    };
  }

  function unlock() {
    try {
      build();
      if (!ctx) return;
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
        const p = ctx.resume();
        if (p && typeof p.then === 'function') p.catch(() => {});
      }
      // iOS vil have rigtig afspilning inde i selve klikkets kaldstak.
      if (!primed) {
        primed = true;
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(master);
        s.onended = () => { try { s.disconnect(); } catch (e) { /* ok */ } };
        s.start(ctx.currentTime);
      }
    } catch (e) {
      dead = true;
    }
  }

  function setMuted(v) {
    const next = !!v;
    const wasMuted = muted;
    muted = next;
    try {
      if (!ctx || !master) return;
      const t = ctx.currentTime;
      const g = master.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(next ? 0.0001 : MASTER_GAIN, t + 0.2);
      if (wasMuted && !next && ready()) click();   // lille kvittering
    } catch (e) { /* tavs */ }
  }

  function isMuted() { return muted; }

  return {
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    spinStart: voice(spinStart),
    // spinLoop skal kunne slukkes selv når lyden er slået fra undervejs.
    spinLoop: raw(function (on) { if (on) { if (ready()) startLoop(); } else stopLoop(); }),
    ringStop: voice(ringStop),
    shatter: voice(shatter),
    cascade: voice(cascade),
    reactor: voice(reactor),
    win: voice(win),
    prismCharge: voice(prismCharge),
    bonusStart: voice(bonusStart),
    bonusEnd: voice(bonusEnd),
    tick: voice(tick),
    click: voice(click),
  };
}
