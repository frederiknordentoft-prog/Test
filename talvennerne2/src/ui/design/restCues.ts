// The attention cues that keep moving while the app rests (SPEC A25): each asks the child for
// something or shows what is speaking, so it must never freeze. Every other endless loop on a
// screen that rests has a rest twin in its own stylesheet (`:root[data-rest] …`), and no cue has
// one: rest.css.test.ts holds the stylesheets to this list, and rest.e2e.mjs checks it in Chromium.
export const REST_CUES = [
  // help buttons: the lightbulb after 10 s, the big confirm button, "Fortsæt"
  '.tv-pulse',
  '.tv-confirm.tv-pulse',
  '.tv-continue__btn',
  // answer cards being read aloud or pointed at
  '.tv-answer.is-target .tv-answer__face',
  '.tv-answer.is-speaking .tv-answer__face',
  // the map and the tasks
  '.tv-meter.is-full .tv-meter__badge',
  '.tv-stone__halo',
  '.tv-nline__hint',
  '.tv-slot.is-next .tv-slot__face',
  '.tv-clockset__dial.is-fresh .tv-clockset__knob',
  '.tv-hear.is-speaking .tv-hear__wave',
  // an egg ready to hatch, a profile about to be deleted, the animal's blink
  '.zoo-egg.is-ready .zoo-egg__body',
  '.tv-pcard.is-deleting .tv-pcard__face',
  '.rig .a-blink',
] as const
