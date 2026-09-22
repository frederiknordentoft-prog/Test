# Modul: type

Dev-server port: 5183

Du ejer: src/render/type/*

## Opgave
Implement 'Isfont' (CONTRACTS.md §4, PLAN.md §6 typography): a custom geometric display typeface defined in code as monoline polylines/arcs on a 10×14 grid with 12° cut terminals, slightly condensed, premium (think luxury watch / sci-fi title design, not a coder font). Glyphs: A–Z, ÆØÅ, 0–9, '. , : % × + − - / · !' and space, with hand-tuned advance widths and kerning pairs for the logo words NORDLYS, SOLSTORM, EKSTREM, GEVINST. Build the SDF atlas on the CPU (distance to capsule segments; R=distance, G=normalised arc-length for stroke reveal) into a BufferImageSource texture (survives context loss). Render each glyph as a sprite/mesh quad with a custom shader: styles ice (#EAF8FF→white body, cool cyan glow), gold (#FFD36B→#FFB547, warm glow, only used for money wins), molten (#FFF4E0→#FF6A00→#FFC23D emissive metal), plasma (magenta/crimson), muted (#7F93B2); bevel from the SDF gradient, inner highlight, outer glow controlled by .glow, light sweep controlled by .sweep, stroke reveal by .reveal (arc-length ≤ reveal). Changing .text must be cheap (count-up numbers change every frame: reuse glyph objects, no reallocation). Tabular digits. Harness dev/type.html: NORDLYS logo big, SOLSTORM molten, 'G5 · EKSTREM', 'STOR GEVINST' gold, '1.234,50 KR', '×128', full alphabet; hash #reveal=0.5 etc. Make the NORDLYS lockup look like a real game logo.
