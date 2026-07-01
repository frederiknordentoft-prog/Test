import type { LevelDef } from '../src/types'

// ---------------------------------------------------------------------------
// The shipped level pack. Every level here is verified solvable by the headless
// solver (`npm run solve:levels`). Coordinates are in board pixels; the canvas
// scales the board to fit the screen. See README.md ("How to add a level").
//
// Design guide (from calibration, drop ~180px above a slot):
//   ramp   rot0/1 → throw left  ~200px | rot2/3 → throw right ~215px
//   funnel rot0 → left ~240 | rot1 → right ~148 | rot2 → left ~148 | rot3 → right ~235
//   bouncer         → like ramp but more energetic (can clear low walls)
//   spinner         → orientation-sensitive "wildcard" kick
// ---------------------------------------------------------------------------

const BOARD_W = 440
const BOARD_H = 680

export const LEVELS: LevelDef[] = [
  {
    id: 'l1',
    name: 'Første kast',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 372, y: 632 }, radius: 40 },
    staticObstacles: [],
    slots: [{ id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] }],
    inventory: { ramp: 1 },
  },
  {
    id: 'l2',
    name: 'Venstre om',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 68, y: 632 }, radius: 40 },
    staticObstacles: [],
    slots: [{ id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] }],
    inventory: { funnel: 1 },
  },
  {
    id: 'l3',
    name: 'Forbi muren',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 360, y: 628 }, radius: 32 },
    staticObstacles: [{ position: { x: 220, y: 470 }, shape: 'wall', size: { x: 70, y: 12 } }],
    slots: [
      { id: 'a', position: { x: 220, y: 200 }, allowedTypes: [] },
      { id: 'b', position: { x: 330, y: 380 }, allowedTypes: [] },
    ],
    inventory: { ramp: 1, bouncer: 1 },
  },
  {
    id: 'l4',
    name: 'Slalom',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 362, y: 650 }, radius: 28 },
    staticObstacles: [
      { position: { x: 300, y: 430 }, shape: 'peg', size: { x: 11 } },
      { position: { x: 165, y: 340 }, shape: 'peg', size: { x: 11 } },
    ],
    slots: [
      { id: 'a', position: { x: 220, y: 190 }, allowedTypes: [] },
      { id: 'b', position: { x: 315, y: 330 }, allowedTypes: [] },
      { id: 'c', position: { x: 150, y: 500 }, allowedTypes: [] },
    ],
    inventory: { ramp: 2 },
  },
  {
    id: 'l5',
    name: 'Præcision',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 300, y: 628 }, radius: 26 },
    failZones: [
      { position: { x: 210, y: 636 }, radius: 30 },
      { position: { x: 390, y: 636 }, radius: 30 },
    ],
    staticObstacles: [],
    slots: [
      { id: 'a', position: { x: 220, y: 200 }, allowedTypes: [] },
      { id: 'b', position: { x: 300, y: 400 }, allowedTypes: [] },
    ],
    inventory: { ramp: 1, funnel: 1 },
  },
  {
    id: 'l6',
    name: 'Mesterværket',
    boardWidth: BOARD_W,
    boardHeight: BOARD_H,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 70, y: 628 }, radius: 30 },
    staticObstacles: [
      { position: { x: 120, y: 430 }, shape: 'peg', size: { x: 10 } },
      { position: { x: 330, y: 520 }, shape: 'wall', size: { x: 60, y: 12 } },
    ],
    slots: [
      { id: 'a', position: { x: 220, y: 170 }, allowedTypes: [] },
      { id: 'b', position: { x: 320, y: 330 }, allowedTypes: [] },
      { id: 'c', position: { x: 150, y: 470 }, allowedTypes: [] },
      { id: 'd', position: { x: 300, y: 610 }, allowedTypes: [] },
    ],
    inventory: { ramp: 1, funnel: 1, bouncer: 1 },
  },
]

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id)
}
