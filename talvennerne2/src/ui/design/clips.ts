// Danish text for the fixed UI clips used by src/ui/design and src/ui/shell (SPEC §10.2, "UI"). The
// clip catalogue is the string table; this map is written in the catalogue's shape (id → text) so the
// speech owner can register it as-is (proposed home: src/speech/clips/ui/design.ts). Until then the
// design harness shows these texts through SpeechProvider; production shows clipText(id).
import type { ClipId } from '../../engine/types'

export const UI_CLIPS = {
  // Round and task chrome
  's.ui.replay': 'Hør igen',
  's.ui.showMe': 'Vis mig',
  's.ui.hint': 'Få hjælp',
  's.ui.check': 'Færdig',
  's.ui.delete': 'Slet',
  's.ui.close': 'Luk',
  's.ui.back': 'Tilbage',
  's.ui.next': 'Næste',
  's.ui.toMap': 'Til kortet',
  's.ui.play': 'Spil',
  's.ui.skip': 'Spring over',
  's.ui.adult': 'For voksne',
  's.ui.yes': 'Ja',
  's.ui.no': 'Nej',
  's.ui.soundOn': 'Lyd til',
  's.ui.soundOff': 'Lyd fra',
  's.ui.stones': 'Turen',
  // Dock
  's.ui.dock.map': 'Kort',
  's.ui.dock.animals': 'Dyr',
  's.ui.dock.wardrobe': 'Garderobe',
  's.ui.dock.shop': 'Butik',
  's.ui.dock.books': 'Bøger',
  // Map HUD meters (read aloud on tap; the meters never show numbers)
  's.ui.meter.egg': 'Dit æg bliver varmere, hver gang du regner rigtigt.',
  's.ui.meter.wish': 'Sådan kommer du tættere på dit ønske.',
  's.ui.meter.heart': 'Hjertet fyldes, når I regner sammen.',
} as const satisfies Record<ClipId, string>

export type UiClipId = keyof typeof UI_CLIPS
