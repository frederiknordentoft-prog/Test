// Names in the wave-2 task kinds (clockSet, pay, share, colorParts): what the controls are called
// when VoiceOver or a tap asks, and the tray's sum, read as support on a new key ("I bakken er der"
// + the amount). The coins and notes are named by the money clips (noun.coin.*).
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'

export const clips: Readonly<Record<ClipId, string>> = {
  's.kind.clockSet.dial': 'Uret',
  's.kind.pay.purse': 'Pungen',
  's.kind.pay.tray': 'Bakken',
  's.kind.pay.back': 'Læg den tilbage',
  's.kind.pay.inTray': 'I bakken er der',
  's.kind.share.pile': 'Bunken',
  's.kind.share.plate': 'Tallerken',
  's.kind.colorParts.part': 'En del',
}

/** They come with the wave-2 kinds (1.–2. klasse). */
export const wave: Wave = 2
