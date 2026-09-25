// "Balanceret" bot (spec 8): tilpasser sig tilsynstilliden, hybrid/egen platform, udvider efter afgift og kanalisering,
// bruger AI fra 2026 med høj overvågning. Selve motoren er profilstyret (strategi.ts).
import { BALANCERET, lavBot } from './strategi';

export const balanceretBot = lavBot(BALANCERET);
