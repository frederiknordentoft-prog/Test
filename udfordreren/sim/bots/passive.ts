// Passiv bot: gør intet ud over at besvare events (bruges til markedskalibrering, spec 9 fase 3).
import type { Action } from '../../src/sim/types';
import type { Bot } from './types';

export const passivBot: Bot = {
  navn: 'Passiv',
  beslut(s) {
    return s.ventendeEvents.map((e) => ({ t: 'eventChoice', eventId: e.eventId, valg: 0 }) as Action);
  },
};
