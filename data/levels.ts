import type { LevelDef } from '../src/types'

// ---------------------------------------------------------------------------
// The shipped level pack: 14 levels in 3 worlds (kravspec §6). Every level is
// verified by `npm run solve:levels`, which proves ★1/★2/★3 achievable,
// derives par, rejects empty wins on any allowed ball, and enforces a strictly
// falling solution-density curve within each world. Coordinates are in board
// pixels; the canvas scales the board to fit the screen.
//
// Calibration (drop 220,24 → slot 220,210, iron — see _design.ts map):
//   ramp    rot1→x397 rot2/3→right wall · rot4→x121 rot5/6→left wall rot7→x43
//           rot0 = flat shelf: catches and parks the ball
//   bouncer rot1→x378 (apex 159) … springier, higher arcs; rot0 bounces in place
//   funnel  rot0/1/15 pass through (drift ~-49) · rot2→x41 · rot14→x399
//   booster rot0-3 hard right · rot8-11 hard left · rot12-15 up/right (apex → ceiling)
//   floor-roll targets: |671 - zoneY| must be < zoneRadius (ball centre rolls at 671)
// ---------------------------------------------------------------------------

const BOARD_W = 440
const BOARD_H = 680

export const LEVELS: LevelDef[] = [
  // ────────────────────────── Verden 1 — Værkstedet ──────────────────────────
  {
    id: 'k1',
    world: 1,
    name: 'Første kast',
    intent: 'Tutorial: placér, rotér, slip — én rampe, ét kast.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 386, y: 620 }, radius: 48 },
    staticObstacles: [],
    slots: [{ id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] }],
    inventory: { ramp: 1 },
    balls: ['iron'],
  },
  {
    id: 'k2',
    world: 1,
    name: 'Begge veje',
    intent: 'Rotation betyder alt: samme slot, målet står nu til venstre.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 64, y: 640 }, radius: 34 },
    staticObstacles: [],
    slots: [{ id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] }],
    inventory: { ramp: 1 },
    balls: ['iron'],
  },
  {
    id: 'k3',
    world: 1,
    name: 'Stjernevejen',
    intent: 'Mønter: den lige vej giver ★1 — omvejen over mønten giver ★2.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 388, y: 644 }, radius: 30 },
    staticObstacles: [],
    coins: [{ id: 'c1', position: { x: 300, y: 406 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] },
      { id: 'b', position: { x: 320, y: 420 }, allowedTypes: [] },
    ],
    inventory: { ramp: 1 },
    balls: ['iron'],
  },
  {
    id: 'k4',
    world: 1,
    name: 'Blød landing',
    intent: 'Tragten: fang en skæv ankomst og centrér den.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 150, y: 24 },
    targetZone: { position: { x: 250, y: 644 }, radius: 28 },
    failZones: [{ position: { x: 70, y: 650 }, radius: 34 }],
    staticObstacles: [{ position: { x: 150, y: 150 }, shape: 'wall', size: { x: 46, y: 7 }, rotation: 0.42 }],
    coins: [{ id: 'c1', position: { x: 265, y: 505 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 250, y: 340 }, allowedTypes: ['funnel'] },
      { id: 'b', position: { x: 360, y: 200 }, allowedTypes: [] },
    ],
    inventory: { funnel: 1 },
    balls: ['iron'],
  },
  {
    id: 'k5',
    world: 1,
    name: 'Opspring',
    intent: 'Trampolinen: op over en mur som en rampe ikke kan klare.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 396, y: 644 }, radius: 30 },
    staticObstacles: [{ position: { x: 330, y: 440 }, shape: 'wall', size: { x: 10, y: 240 } }],
    coins: [{ id: 'c1', position: { x: 330, y: 168 }, radius: 12 }],
    slots: [{ id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] }],
    inventory: { ramp: 1, bouncer: 1 },
    balls: ['iron'],
  },

  // ───────────────────────── Verden 2 — Maskinhallen ─────────────────────────
  {
    id: 'k6',
    world: 2,
    name: 'Fuld fart',
    intent: 'Booster: kuglen er for langsom til at nå over graven — accelerér den.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 408, y: 644 }, radius: 28 },
    failZones: [
      { position: { x: 170, y: 656 }, radius: 40 },
      { position: { x: 250, y: 656 }, radius: 40 },
      { position: { x: 330, y: 656 }, radius: 40 },
    ],
    staticObstacles: [],
    coins: [{ id: 'c1', position: { x: 337, y: 411 }, radius: 12 }],
    slots: [{ id: 'a', position: { x: 220, y: 300 }, allowedTypes: ['booster'] }],
    inventory: { booster: 1 },
    balls: ['iron'],
  },
  {
    id: 'k7',
    world: 2,
    name: 'Gennembrud',
    intent: 'Breakable + kuglevalg: jern knuser sig igennem — basketball må udenom.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 140, y: 24 },
    targetZone: { position: { x: 300, y: 644 }, radius: 30 },
    staticObstacles: [],
    breakables: [{ id: 'b1', position: { x: 300, y: 430 }, size: { x: 55, y: 7 }, breakImpulse: 60 }],
    coins: [{ id: 'c1', position: { x: 300, y: 540 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 140, y: 210 }, allowedTypes: [] },
      { id: 'b', position: { x: 390, y: 180 }, allowedTypes: [] },
    ],
    inventory: { ramp: 1 },
    balls: ['iron', 'basketball'],
  },
  {
    id: 'k8',
    world: 2,
    name: 'Hul i væggen',
    intent: 'Portal: den eneste vej gennem en massiv mur.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 340, y: 644 }, radius: 30 },
    staticObstacles: [{ position: { x: 220, y: 430 }, shape: 'wall', size: { x: 220, y: 10 } }],
    coins: [{ id: 'c1', position: { x: 340, y: 580 }, radius: 12 }],
    portalExit: { position: { x: 340, y: 500 }, rotation: Math.PI / 2 },
    slots: [
      { id: 'a', position: { x: 220, y: 260 }, allowedTypes: [] },
      { id: 'b', position: { x: 120, y: 330 }, allowedTypes: ['portal'] },
    ],
    inventory: { portal: 1, ramp: 1 },
    balls: ['iron'],
  },
  {
    id: 'k9',
    world: 2,
    name: 'To trin',
    intent: 'Kæd to brikker: første kast skal levere kuglen præcist til det andet.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 262, y: 487 }, radius: 22 },
    failZones: [{ position: { x: 50, y: 652 }, radius: 32 }],
    staticObstacles: [],
    coins: [{ id: 'c1', position: { x: 284, y: 445 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 220, y: 200 }, allowedTypes: [] },
      { id: 'b', position: { x: 360, y: 380 }, allowedTypes: [] },
    ],
    inventory: { ramp: 2 },
    balls: ['iron'],
  },
  {
    id: 'k10',
    world: 2,
    name: 'Sparsommelighed',
    intent: 'Par-pres: tre brikker frister — de bedste klarer det med to.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 249, y: 432 }, radius: 18 },
    staticObstacles: [],
    coins: [
      { id: 'c1', position: { x: 160, y: 330 }, radius: 12 },
      { id: 'c2', position: { x: 174, y: 421 }, radius: 12 },
    ],
    slots: [
      { id: 'a', position: { x: 220, y: 190 }, allowedTypes: [] },
      { id: 'b', position: { x: 330, y: 300 }, allowedTypes: [] },
      { id: 'c', position: { x: 120, y: 430 }, allowedTypes: [] },
      { id: 'd', position: { x: 250, y: 520 }, allowedTypes: [] },
    ],
    inventory: { ramp: 2, bouncer: 1 },
    balls: ['iron'],
  },

  // ───────────────────────── Verden 3 — Mesterprøven ─────────────────────────
  {
    id: 'k11',
    world: 3,
    name: 'Slalom 2.0',
    intent: 'Faldgruber flankerer den eneste sikre korridor.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 220, y: 648 }, radius: 30 },
    failZones: [
      { position: { x: 110, y: 652 }, radius: 40 },
      { position: { x: 330, y: 652 }, radius: 40 },
    ],
    staticObstacles: [{ position: { x: 220, y: 340 }, shape: 'wall', size: { x: 30, y: 6 } }],
    coins: [{ id: 'c1', position: { x: 300, y: 400 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 220, y: 180 }, allowedTypes: [] },
      { id: 'b', position: { x: 300, y: 480 }, allowedTypes: [] },
    ],
    inventory: { ramp: 2 },
    balls: ['iron'],
  },
  {
    id: 'k12',
    world: 3,
    name: 'Nålestik',
    intent: 'Lille mål, smal tolerance — tragt-præcision.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 300, y: 24 },
    targetZone: { position: { x: 200, y: 640 }, radius: 24 },
    failZones: [
      { position: { x: 140, y: 650 }, radius: 28 },
      { position: { x: 262, y: 650 }, radius: 28 },
    ],
    staticObstacles: [],
    coins: [{ id: 'c1', position: { x: 185, y: 505 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 300, y: 180 }, allowedTypes: ['ramp'] },
      { id: 'b', position: { x: 200, y: 330 }, allowedTypes: ['funnel'] },
    ],
    inventory: { ramp: 1, funnel: 1 },
    balls: ['iron'],
  },
  {
    id: 'k13',
    world: 3,
    name: 'Maskinen',
    intent: '3-briks kæde: levér, accelerér — og knus igennem til sidst.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 360, y: 24 },
    targetZone: { position: { x: 410, y: 648 }, radius: 26 },
    staticObstacles: [
      { position: { x: 404, y: 512 }, shape: 'wall', size: { x: 36, y: 8 } },
      { position: { x: 90, y: 556 }, shape: 'wall', size: { x: 44, y: 7 } },
    ],
    breakables: [{ id: 'b1', position: { x: 368, y: 594 }, size: { x: 7, y: 86 }, breakImpulse: 75 }],
    coins: [{ id: 'c1', position: { x: 240, y: 560 }, radius: 12 }],
    slots: [
      { id: 'a', position: { x: 360, y: 200 }, allowedTypes: [] },
      { id: 'b', position: { x: 180, y: 470 }, allowedTypes: [] },
      { id: 'c', position: { x: 90, y: 538 }, allowedTypes: ['booster'] },
    ],
    inventory: { ramp: 2, booster: 1 },
    balls: ['iron', 'wood'],
  },
  {
    id: 'k14',
    world: 3,
    name: 'Mesterværket 2.0',
    intent: 'Alle mekanikker i én maskine — finalen.',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 415, y: 648 }, radius: 24 },
    staticObstacles: [
      { position: { x: 252, y: 340 }, shape: 'wall', size: { x: 8, y: 340 } }, // full divider
      { position: { x: 417, y: 546 }, shape: 'wall', size: { x: 23, y: 8 } }, // pocket roof
    ],
    breakables: [{ id: 'b1', position: { x: 394, y: 610 }, size: { x: 7, y: 70 }, breakImpulse: 75 }],
    coins: [
      { id: 'c1', position: { x: 155, y: 350 }, radius: 12 },
      { id: 'c2', position: { x: 330, y: 430 }, radius: 12 },
    ],
    portalExit: { position: { x: 330, y: 140 }, rotation: Math.PI / 2 },
    slots: [
      { id: 'a', position: { x: 220, y: 180 }, allowedTypes: ['ramp'] },
      { id: 'd', position: { x: 100, y: 140 }, allowedTypes: ['ramp'] },
      { id: 'b', position: { x: 132, y: 428 }, allowedTypes: ['portal'] },
      { id: 'c', position: { x: 330, y: 560 }, allowedTypes: ['booster'] },
      { id: 'e', position: { x: 60, y: 600 }, allowedTypes: ['booster'] },
    ],
    inventory: { ramp: 1, portal: 1, booster: 1 },
    balls: ['iron', 'wood'],
  },
]

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id)
}
