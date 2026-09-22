# Modul: post

Dev-server port: 5185

Du ejer: src/render/fx/UberPost.ts, src/render/fx/Bloom.ts (+ helpers under src/render/fx/post/*)

## Opgave
Implement the post stack (CONTRACTS.md §6, PLAN.md §6 post). UberPost: a single Filter (resolution 'inherit') with two compiled program variants (base: CA + lift/gamma/gain grade blending cool-base → warm-crimson storm by .storm + vignette + animated grain; cinematic: all of base + 8-tap radial zoom blur around zoomCenter, up to 3 shock rings (refractive displacement + bright rim, from .rings Float32Array x,y,r,strength in 0..1 uv), glitch bands (horizontal slice offsets + RGB split, driven by .glitch), heat haze in the top 25% (.heat), exposure flash toward #FFF4E0 (.exposure)). Switching .cinematic swaps glProgram (verify this works in Pixi v8 and doesn't recompile per frame; pre-warm both). Bloom: threshold extract + Kawase blur at ~quarter res + additive combine — you may use pixi-filters (KawaseBlurFilter / AdvancedBloomFilter from 'pixi-filters') if quality and cost are right; expose threshold & strength; strength 1.0 base, 1.6 storm. Order on the world container: [bloom, uber]. Harness dev/post.html: a test scene (dark bg, bright glowing shapes, crisp small text, a gem-like gradient) with hash params to toggle each effect; screenshot each effect at 390x844 dpr 2 and verify with a pixel check that base UberPost does NOT soften text at DPR 2 (resolution inherit). Keep it cheap: report measured frame cost if you can (SwiftShader numbers are only indicative).
