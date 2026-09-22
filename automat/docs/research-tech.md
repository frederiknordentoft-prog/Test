# Tech research: procedural AAA slot UI demo (Pixi v8 stack)

Everything below was checked read-only on 2026-09-22 against npm metadata, the shipped `.d.ts`/`.mjs` sources on jsDelivr, the official docs, and the artifact contract. I did not install anything, launch a browser or test WebGL. Items marked **[UNVERIFIED]** still need checking in the build phase.

## 0. Verified versions and packages
- **Current versions:**
  - pixi.js **8.21.0** (published 2026-09-17)
  - pixi-filters **6.1.5**. Last published Nov 2025. Its peer dependency is `pixi.js >=8.0.0-0`. `sideEffects:false`, and each filter has its own import path (`pixi-filters/shockwave`, etc.).
  - gsap **3.15.0**
  - vite **8.3.0**
  - vite-plugin-singlefile **2.3.3** (peer vite ^5–^8)
  - tone **15.1.22**
  - vitest **5.0.1** (peer vite ^8 OK)
- **TypeScript:** `latest` is now **7.0.2**, the native Go port, tagged today. The create-vite 9.2.1 `vanilla-ts` template still pins `typescript ~6.0.2` with `vite ^8.3.0`. **Pin TS ~6.0.3.**
- **Template tsconfig** sets `erasableSyntaxOnly: true`. That means no `enum`, no `namespace` and no parameter properties. Use `as const` objects and unions instead.
- **Node 22.22.2 runs .ts files directly** (`process.features.typescript === 'strip'`). So `node sim/run.ts` works with no tsx, as long as code is erasable and imports use `.ts` extensions (the template already sets `allowImportingTsExtensions`). The machine has 4 cores, so the Monte Carlo can run on 4 `worker_threads`.
- **Playwright version mismatch:** the global install is 1.56.1 with browsers in `/opt/pw-browsers` (chromium-1194 plus headless_shell-1194, `PLAYWRIGHT_BROWSERS_PATH` already set). npm latest is 1.63.0, which expects a different Chromium revision. **Pin `playwright@1.56.1`.**
- **Not usable with v8:** `@pixi/particle-emitter` 5.0.10 has peer `@pixi/* <8`. Write our own emitter on `ParticleContainer`.
- **Measured gzip sizes of the full CDN builds:**

  | Package | gzip |
  |---|---|
  | pixi.min.mjs | 233 KB |
  | pixi-filters | 44 KB |
  | gsap core | 28 KB |
  | Tone.js | 79 KB (no `sideEffects` field, so it tree-shakes badly) |

## 1. Pixi.js v8.21

### Initialisation
```ts
import 'pixi.js/unsafe-eval';            // replaces Pixi's new Function() uniform/shader-sync code with polyfills; artifact CSP eval status unknown
const app = new Application();
await app.init({ preference: ['webgl'], resizeTo: hostEl, resolution: res, autoDensity: true,
  antialias: false, powerPreference: 'high-performance', background: '#07040d', backgroundAlpha: 1 });
hostEl.appendChild(app.canvas);          // app.canvas, not app.view
```
- **`preference` as a string** means "try this renderer first, then fall back in the default order". **As an array** it is a whitelist.
- **Canvas2D fallback:** 8.21 ships a Canvas2D renderer (`'canvas'`), but it has no filters or custom shaders. Use `['webgl']` and show a static poster if WebGL fails.
- **Skip WebGPU.** Every custom shader would also need a WGSL `GpuProgram`. Under WebGPU, a Filter without a `gpuProgram` is silently skipped.
- **Dynamic imports:** `autoDetectRenderer` loads renderers with dynamic imports. The single-file build inlines them, so this is fine.

### Custom filter
Uniforms inside a filter:
- **Globals Pixi provides:** `uInputSize`, `uInputPixel`, `uInputClamp`, `uOutputFrame`, `uGlobalFrame`, `uOutputTexture`.
- **Default vertex shader:** Pixi's default filter vertex shader writes `vTextureCoord`.

```ts
const post = new Filter({
  glProgram: GlProgram.from({ vertex: filterVert, fragment: postFrag, name: 'uber-post',
    preferredFragmentPrecision: 'highp' }),
  resources: { post: { uTime:{value:0,type:'f32'}, uCA:{value:0,type:'f32'},
    uRings:{value:new Float32Array(12),type:'vec4<f32>',size:3} } },
});
post.resources.post.uniforms.uTime = t;   // update each frame
```

Three shader pitfalls, all read from the `GlProgram.mjs` source:
- **Write the `#version 300 es` header yourself.** It must be the first line of both vertex and fragment shaders, and you declare `out vec4 finalColor;` yourself. Without the header, Pixi compiles the shader as GLSL ES 1.00 using macros (`in`→`varying`, `texture`→`texture2D`, `finalColor`→`gl_FragColor`). You then lose `fwidth`/`dFdx` (needed for SDF antialiasing), dynamic loops and `texelFetch`.
- **Default fragment precision is `mediump`.** On mobile that is fp16, which makes noise and time-based shaders jitter. Pass `preferredFragmentPrecision:'highp'` and wrap `uTime` (for example `mod(t, 1000.)`).
- **`vTextureCoord` is in pooled render-texture space.** For 0..1 screen UVs use `vTextureCoord * uInputSize.xy / uOutputFrame.zw`, and clamp samples with `uInputClamp`.

### Full-screen background
- **Mesh:** a `Mesh` with a `MeshGeometry({positions, uvs, indices})` quad and `Shader.from({ gl:{vertex,fragment}, resources:{…} })`.
- **Vertex uniforms:** `uProjectionMatrix`, `uWorldTransformMatrix`, `uTransformMatrix` (plus `uColor` and `uResolution`). Compute `gl_Position = vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.)).xy,0.,1.)`. Attributes are `aPosition` and `aUV`.
- **Render at half resolution:** draw into a `RenderTexture.create({width:w/2,height:h/2})` with `app.renderer.render({ container: bgMesh, target: rt, clear: true })`, then show it as a `Sprite(rt)` scaled ×2.

### Other v8 APIs
- **ParticleContainer:**
  - Takes only `Particle` objects (props: `x`, `y`, `scaleX`, `scaleY`, `anchorX`, `anchorY`, `rotation`, `color`, `tint`, `alpha`, `texture`), added with `addParticle`.
  - All particles must share one texture source, so build a procedural particle atlas.
  - `dynamicProperties` defaults to `{position:true, rotation:false, vertex:false, uvs:false, color:false}`. Turn on `vertex` for scale changes and `color` for alpha fades.
  - Bounds are not computed, so set `boundsArea`. Call `update()` after changing static properties. The docs still label it EXPERIMENTAL.
- **Baking textures:**
  - Use `renderer.generateTexture({ target, frame, resolution, antialias, clearColor })`, or `RenderTexture.create` plus `renderer.render`.
  - `TextureSource.autoGarbageCollect` defaults to `false` (checked in source), so baked textures are not garbage-collected.
  - Render textures are lost on WebGL context loss. Make every bake function idempotent and re-run it on context restore. The hook is `renderer.runners.contextChange` **[UNVERIFIED name]**.
  - `Texture.from(canvas)` keeps a CPU copy and survives context loss by itself.
- **Graphics v8:**
  - Draw the shape first, then style it: `.roundRect().fill({color,alpha}).stroke({width,color,alignment})`.
  - Available: `.cut()`, `.star()`, `.regularPoly()`, `.chamferRect()`, `.filletRect()`, `.svg(str)`, and a shareable `GraphicsContext`.
  - `FillGradient({ type:'linear'|'radial', start, end, colorStops:[{offset,color}], textureSpace:'local' })`. The default `textureSpace` is `'local'` (0..1 of the shape bounds).
  - Bake static art once. Don't rebuild Graphics every frame. For animated beams or lightning use **`MeshRope`** (`autoUpdate`) with additive blending.
- **Other scene tools:**
  - `PerspectiveMesh.setCorners()` / `MeshPlane` give 2.5D tilt or reel curvature.
  - `RenderLayer.attach()` lets winning symbols draw above the frame without reparenting.
  - `SplitText` and `SplitBitmapText` exist for per-glyph title animation.
  - `container.cacheAsTexture()` for static UI.
- **Text:**
  - Install a bitmap font with `BitmapFont.install({ name, style:{fontFamily, fontSize, fill: FillGradient, stroke:{…}, dropShadow:{…}}, chars:[['0','9'],'.,+x kr'], resolution:2, padding:4 })`, then use `new BitmapText(...)`.
  - Never change a `Text` every frame; it re-renders a canvas and re-uploads it.
  - Better: a digit-sprite "odometer" from our own baked atlas, which allows per-digit roll and bounce with zero allocations.
- **Blend modes:**
  - Native WebGL: `normal`, `add`, `screen`, `multiply`, `erase`, `none`, `min`, `max`, plus `-npm` variants.
  - `pixi.js/advanced-blend-modes` are filter-based and copy the back buffer, so keep them out of hot paths.
  - Each blend-mode change breaks batching, so group all additive sprites in one layer.
  - In v8, `container.tint` propagates to children, which is handy for mode colour shifts.
- **Masks:**
  - Cost order: rectangle/scissor < Graphics stencil < sprite/alpha mask (which is a filter).
  - Use one Graphics rect mask on the whole reel container, or no mask: let the frame art and top/bottom gradient covers hide the overflow.
  - A `ScissorMask` class exists, but I could not confirm Pixi picks it automatically for rect masks **[UNVERIFIED]**.
- **v7→v8 gotchas:**
  - `await app.init()` is required.
  - Sprites, Graphics and Meshes can't have children; wrap them in a `Container`.
  - Use `eventMode='static'`.
  - The ticker callback receives the ticker: `(ticker)=>ticker.deltaMS`.
  - `getBounds()` returns a Bounds object; use `.rectangle`.
  - `cacheAsBitmap` became `cacheAsTexture()`.
  - `Texture.from(url)` no longer loads anything.
  - **Always reassign the `filters` array.** In-place `push` and toggling `.enabled` have had bugs (pixijs #11081, #11333). Keep the filter instances and drive their intensity to 0 instead of toggling. GSAP's PixiPlugin also does `target.filters=[...filters, f]`.
  - Performance tip from the docs: set `container.filterArea = new Rectangle(...)` (for the stage: `app.stage.filterArea = app.screen`) so Pixi skips bounds measurement.

## 2. pixi-filters 6.1.5: cost and use (all built for v8, WebGL and WebGPU)

| Filter | Cost | Use |
|---|---|---|
| ShockwaveFilter | 1 pass, cheap | Big-win and unlock rings |
| RGBSplitFilter | 1 pass, 3 texture reads | Chromatic hits (fold into our own post filter) |
| ZoomBlurFilter | up to `maxKernelSize` (default 32) reads | Extreme transition, short bursts; use 16 on mobile |
| MotionBlurFilter | `kernelSize` reads | Avoid for reels; bake pre-blurred symbol variants instead |
| KawaseBlurFilter | N cheap passes (`quality`, `pixelSize`, `clamp`) | Building block for bloom at resolution 0.25–0.5 |
| AdvancedBloomFilter | Brightness extract + Kawase + combine, all at **input size** (`TexturePool.getSameSizeTexture`) | Only on a small glow layer with `resolution 0.5`, never the whole stage on mobile |
| BloomFilter | Alpha + Gaussian blur | Simpler alternative with similar cost |
| GlowFilter | about 2π·quality·distance² reads per pixel; distance is baked into the shader at construction (10/0.1 ≈ 63 reads, 20/0.5 ≈ 1250) | **Never on large or animated targets.** Bake glows into textures |
| GodrayFilter | fBm Perlin noise per pixel, heavy | Only at low resolution, or write cheaper light shafts into the background shader |
| GlitchFilter | 1 pass; `refresh()` regenerates a displacement canvas | Good for a short Extreme-unlock sting |
| BulgePinch / Twist | 1 pass, cheap | Portal effect |
| CRT / AdjustmentFilter / ColorOverlay / HslAdjustment | 1 pass | Fold into our own post filter |
| BackdropBlurFilter | Needs a back-buffer copy | Avoid on mobile |

**Recommendation:** write one custom "uber" post-process filter on `app.stage` (with `filterArea = app.screen`). In a single pass it does:
- chromatic aberration
- vignette
- grain
- colour grade and saturation
- exposure flash
- up to 3 shockwave rings passed as uniforms
- optional radial zoom taps

Each stacked filter adds a render target and a batch break, so 4–6 separate filters cost far more. Use pixi-filters for prototyping and for Kawase (bloom) and Glitch.

## 3. GSAP 3.15
- **License:** "Standard no-charge license". GSAP and all formerly paid plugins have been free for commercial use since 30 Apr 2025 (Webflow). The only restriction: you can't use it to build no-code animation tools that compete with Webflow. That's fine for a game. It is not OSI open source, so Danske Spil legal may want to review it.
- **Minified plugin sizes:** CustomEase 7 KB, CustomBounce 2 KB, CustomWiggle 2 KB, EasePack 2.4 KB (including ExpoScaleEase, good for zooms), Physics2D 2.2 KB, PixiPlugin 6.6 KB (the source has an `_isV8Plus` branch, so it knows v8).
- **Useful APIs:** `gsap.quickTo`/`quickSetter` for per-frame values without allocations, and `gsap.utils` (`mapRange`, `clamp`, `wrap`, `interpolate`).
- **One clock:** `gsap.ticker.remove(gsap.updateRoot)`, then in `app.ticker.add(() => gsap.updateRoot(gameTimeSec), null, UPDATE_PRIORITY.HIGH)` (confirmed `updateRoot` in the 3.15 source and types). This avoids a one-frame lag between GSAP and Pixi. Hit-stop and slow-motion then work by scaling game time, which also slows the tweens. `gsap.globalTimeline.timeScale()` is an alternative.
- **When to use GSAP and when to write our own:**
  - GSAP for authored choreography: reel-stop stagger, win sequences, the Extreme transition. Keep live tweens under about 100.
  - Our own code for:
    - critically-damped springs (meters, squash, settle)
    - trauma-based screen shake (noise from the cosmetic RNG)
    - the particle integrator (SoA `Float32Array`s)
    - the reel state machine (accelerate, constant speed, scheduled stop, landing curve)
  - Never create a GSAP tween per particle.

## 4. Audio: recommend raw WebAudio (our own engine, about 6–10 KB)
- **Why not Tone.js:** it is 79 KB gzip and tree-shakes badly. It starts a Blob-URL Web Worker for its clock (`Ticker` type `"worker"`) and AudioWorklets for some nodes. All our sounds are synthesized anyway.
- **Signal chain:** buses (sfx / music / ui) as `GainNode`s → `DynamicsCompressorNode` used as a limiter → destination. Add one `ConvolverNode` whose impulse response is generated in code (stereo, exponentially decaying noise, 1.5–3 s). Add a `WaveShaperNode` for Extreme distortion and `BiquadFilterNode` sweeps for risers.
- **Pre-render sound effects:** render them at boot or on idle with `OfflineAudioContext` into `AudioBuffer`s. Play them with `AudioBufferSourceNode`, adding `playbackRate`/`detune` jitter from the cosmetic RNG. This is cheap on mobile and avoids glitches when many voices play at once. Keep buffers short, and mono where possible.
- **Adaptive music:**
  - Use a look-ahead scheduler: a 25 ms timer schedules notes 100–150 ms ahead against `ctx.currentTime`.
  - Stems (pad / bass / arp / drums / lead) are gated by an intensity value from 0 to 1, crossfading with `setTargetAtTime`.
  - Extreme mode raises the tempo, changes key, adds distortion and a sidechain pump.
  - Drive beat-synced visuals from `ctx.currentTime` (plus `outputLatency` or `getOutputTimestamp()` where available).
- **Starting audio on iOS:**
  - Create or resume the `AudioContext` inside `pointerup`/`click` and start a one-sample silent buffer.
  - Handle the iOS `'interrupted'` state and `visibilitychange`, and stop the music when the tab is hidden (timers get throttled).
- **iOS silent switch mutes WebAudio.** Setting `navigator.audioSession.type='playback'` before the context is created overrides it (Safari-only API). **Decision to make:** set it only after the player taps "Lyd til". Respecting silent mode by default is the more responsible choice.
- **Haptics:** `navigator.vibrate` works on Android only; iOS Safari never implemented it. The iOS 18 `<input type=checkbox switch>` trick was reportedly patched in iOS 26.5 **[secondary source]**. Treat haptics as Android-only and add a toggle.

## 5. Vite 8, single-file build, artifact, headless screenshots
- **Scaffold:** `npm create vite@latest automat -- --template vanilla-ts`, inside `/home/user/Test/automat` so the dashboard stays untouched.
- **What changed in Vite 8:**
  - It uses Rolldown and Oxc; CSS is minified with Lightning CSS.
  - `build.rollupOptions` is now `build.rolldownOptions` (the old name still works but is deprecated).
  - The default build target is now Safari 16.4 / Chrome 111.
- **vite-plugin-singlefile 2.3.3:**
  - On Vite 8 or later it sets `output.codeSplitting=false`, plus `assetsInlineLimit` → always, `cssCodeSplit:false`, `base:'./'`. Use `viteSingleFile({ removeViteModuleLoader: true })`.
  - **Gotchas:**
    - `public/` files are not inlined.
    - `new Worker(new URL(...))` becomes a separate chunk, so use `import W from './rtp.worker.ts?worker&inline'` (base64 → Blob URL; the artifact allows Blob workers).
    - The plugin doesn't handle worklets.
    - Avoid WASM.
    - No sourcemaps.
- **Artifact rules (from the platform contract):**
  - The platform wraps the page in its own skeleton (doctype, head with charset and `viewport-fit=cover` viewport, a reset with `:root` safe-area padding, and an off-white 14 px body).
  - **The file must not contain `<!doctype>`, `<html>`, `<head>` or `<body>`,** and `<title>` must appear in the first 8 KB.
  - So add a post-build step `scripts/to-artifact.mjs` that emits `<title>…</title><style>…</style><div id="app"></div><script type="module">…</script>`.
  - Set `html,body{height:100%;background:#…}` explicitly.
  - Put `touch-action:none` on the canvas. Overriding the skeleton's viewport meta to block zoom is **[UNVERIFIED]**.
  - **Blocked or unavailable:** `alert`/`confirm`, downloads, service workers, and any fetch/image/style from other hosts (scripts only from cdnjs or jsDelivr `/npm`; styles only from fonts.googleapis.com with fonts.gstatic.com).
  - Deep links: only a bare `#hash` reaches the page.
  - Wrap `localStorage` in try/catch.
  - The size limit is 16 MB, and the bundle will be about 0.6–1 MB of JS.
  - PWA/service worker needs a separate `build:pwa` target.
- **Dev and screenshots:**
  - Serve with `npx vite --host 127.0.0.1 --port 5173 --strictPort` (in the background) or `vite preview --port 4173`, or open `file:///…/dist/index.html` directly (inline module scripts work from file://).
  - Launch Chromium like this:
    ```js
    chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
    // add executablePath:'/opt/pw-browsers/chromium' to use full Chrome in new headless mode
    ```
    Chromium's docs give the WebGL-fallback form as `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`. `libvk_swiftshader.so` is present in both browser folders.
  - **Probe first:** log `WEBGL_debug_renderer_info` and expect "SwiftShader" **[UNVERIFIED here, not run]**.
  - SwiftShader runs on the CPU, so frame rates are meaningless and heavy shaders are slow. Use it only for correctness screenshots.
  - For deterministic shots, expose a `window.__slot` debug API (`seed`, `forceExtreme()`, `freeze(t)`, `step(ms)`). Playwright's `page.clock.install()`/`runFor()` should also fake `requestAnimationFrame` and `performance.now` **[verify]**.
  - Fail the run on `pageerror` or shader-compile console errors.

## 6. Typography without external fonts
- **Google Fonts is allowed in the artifact** (stylesheet from fonts.googleapis.com, files from fonts.gstatic.com). The `&text=` parameter subsets a font to only the characters you list.
  - If you use a web font, you must `await document.fonts.load('900 96px "X"')` before creating Pixi `Text` or calling `BitmapFont.install`. Otherwise Pixi silently bakes the fallback font.
- **Self-made AAA display type is feasible and recommended:**
  - **(a) Glyphs as code.** Build a tiny glyph set only for what we need: the logo letters, "EXTREME", 0–9, `, . x + kr`. Construct them from primitives (chamfered or rounded rects, arcs) as Canvas2D `Path2D` or Pixi Graphics.
  - **(b) Chrome/extruded look at bake time.** Render in Canvas2D at twice the target size, then `Texture.from(canvas)`. Layers:
    - N offset fills that darken for the extrusion
    - a multi-stop gradient with a hard horizon line for chrome
    - an inset bevel stroke
    - `shadowBlur` for the outer glow
    - specular glint sprites
  - **(c) Animated premium look via SDF.** Compute a distance field of each glyph mask in JS (Felzenszwalb EDT is about 60 lines; `@mapbox/tiny-sdf` 2.2.0 works for font glyphs). A custom GLSL 300 es shader then does:
    - a bevel normal from `dFdx`/`dFdy`
    - a procedural environment "matcap" reflection
    - a light sweep
    - glow and outline
    - a dissolve / energy edge for the Extreme reveal

    MSDF isn't needed (msdfgen would require WASM).
- **UI body copy:** use the `system-ui` font stack. Nothing is downloaded and Danish ÆØÅ is guaranteed, which keeps the "all assets self-made" claim honest.
- **Programmatic SDF BitmapFont:** feeding our own SDF atlas into a `BitmapFont` (`distanceField:{type:'sdf'}`) relies on semi-internal API **[uncertain]**. Prefer our own glyph-sprite components.

## 7. Performance budget (6×5 grid, mid-range phone)
- **Resolution:** `res = clamp(min(dpr, 2, sqrt(BUDGET/(cssW*cssH))), 1, 2)`, with BUDGET about 1.6–2.0 MP on mobile and about 3.5 MP on desktop.
  - For reference, 390×844 at 2× is 1.32 MP.
  - `renderer.resolution` has a setter in 8.21, so quality can adapt at runtime.
- **Adaptive tiers:**
  - Track a moving average of frame time: drop a tier after 1.5 s above 19 ms; raise a tier after 5 s below 12 ms.
  - Clamp the ticker delta to 50 ms.
  - Animate on delta time only, because iOS Low Power Mode caps `requestAnimationFrame` at 30 fps.
- **Full-screen pass budget** is about 5–6 full-resolution equivalents at 1.3 MP:

  | Pass | Cost |
  |---|---|
  | Scene | 1 |
  | Post filter | 1 |
  | Background shader (half-res render texture + upscale) | about 0.25 + 1 |
  | Kawase bloom (quarter res) | about 0.3 |
  | Additive particle overdraw | Keep large glow sprites to ≤30–50 |

- **Bloom tiers:**
  - Everywhere: baked pre-blurred additive halos.
  - Glow layer: real Kawase bloom at resolution 0.25–0.5.
  - Desktop and Extreme mode: full-scene bloom at 0.5.
- **Background shader:** render at half resolution. On the Low tier, use a third of the resolution and/or update at 30 Hz.
- **Symbols:**
  - 36 sprites (30 visible + 6 buffer).
  - Four variants per symbol: normal, motion-blurred for spinning, glow halo, and win silhouette. Bake them at boot into one atlas of at most 2048² (256 px cells gives 64 cells), so the reels draw in a single batch.
  - No per-symbol filters.
- **Particles:**
  - One `ParticleContainer` per texture source and blend mode.
  - Caps: Low 600 / Medium 1500 / High 3000 / Desktop 6000.
  - Pooled `Particle` objects with swap-remove.
- **Other targets:** fewer than 40 draw calls. No allocations in the hot loop. Pause on `visibilitychange`. Offer an optional 30 fps battery-saver mode.
- **Memory (iOS):**
  - Keep atlases ≤2048².
  - Zero out scratch canvases after upload, because iOS has a total canvas-memory limit.
  - Re-bake on `webglcontextlost`/restore.
  - Reuse render textures and call `rt.resize()` on window resize.
- **Accessibility:**
  - Under `prefers-reduced-motion`: no shake, zoom blur or chromatic-aberration pulses; crossfade instead.
  - **Photosensitivity:** cap full-screen flashes at 3 per second (WCAG 2.3.1). This matters for the "vildt og voldsomt" Extreme mode.

## Open items to verify first in the build phase
1. That headless SwiftShader WebGL actually initialises with the flags above.
2. Whether the artifact CSP allows `unsafe-eval` (importing `pixi.js/unsafe-eval` covers this defensively).
3. Whether Pixi picks `ScissorMask` automatically for rect masks.
4. The exact `renderer.runners.contextChange` hook name.
5. Whether Playwright's clock also fakes `requestAnimationFrame`.
6. That pixi-filters 6.1.5 works with pixi 8.21: the version range is compatible, but the combination is untested.

Sources:
- [PixiJS v8 migration guide](https://pixijs.com/8.x/guides/migrations/v8)
- [Pixi filters guide](https://pixijs.com/8.x/guides/components/filters)
- [Pixi performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
- [Pixi mesh guide](https://pixijs.com/8.x/guides/components/scene-objects/mesh)
- [pixijs issue #11081](https://github.com/pixijs/pixijs/issues/11081), [pixijs issue #11333](https://github.com/pixijs/pixijs/issues/11333)
- [Vite 8 migration](https://vite.dev/guide/migration), [Vite web workers](https://vite.dev/guide/features#web-workers)
- [Chromium SwiftShader docs](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md)
- [Webflow: GSAP 100% free](https://webflow.com/blog/gsap-becomes-free), [GSAP standard license](https://gsap.com/community/standard-license/)
- [MDN AudioSession.type](https://developer.mozilla.org/docs/Web/API/AudioSession/type), [W3C audio-session explainer](https://github.com/w3c/audio-session/blob/main/explainer.md)
- [ios-haptics library](https://github.com/tijnjh/ios-haptics), [iOS haptics article](https://medium.com/@posaune0423/i-open-sourced-an-oss-library-for-arbitrary-haptic-feedback-in-ios-safari-5b8ca74a5f05)
- The jsDelivr package sources for pixi.js@8.21.0, pixi-filters@6.1.5, gsap@3.15.0, tone@15.1.22, vite-plugin-singlefile@2.3.3 and create-vite@9.2.1

### Critical Files for Implementation
None of these exist yet; all are to be created under the new `automat` folder:
- /home/user/Test/automat/vite.config.ts (singlefile plugin, `?worker&inline`, TS ~6 settings)
- /home/user/Test/automat/scripts/to-artifact.mjs (removes doctype/html/head/body, keeps `<title>` first)
- /home/user/Test/automat/src/render/postfx.ts (one-pass post filter: `#version 300 es`, highp, rings, chromatic aberration, grade)
- /home/user/Test/automat/src/audio/engine.ts (WebAudio buses, OfflineAudioContext pre-rendering, look-ahead scheduler, unlock)
- /home/user/Test/automat/scripts/shoot.mjs (Playwright 1.56.1 with SwiftShader flags, WebGL probe, deterministic screenshots)