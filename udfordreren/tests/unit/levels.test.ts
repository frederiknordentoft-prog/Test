import { describe, expect, it } from 'vitest';
import { niveauForXp, registrerBrug, hallOfFameBonus, NIVEAU_TAERSKLER, niveauFaktor } from '../../src/sim/levels';
import { nyt } from './helpers';

describe('Type- og temaniveauer', () => {
  it('niveau 1-10 følger tærsklerne', () => {
    expect(niveauForXp(0)).toBe(1);
    expect(niveauForXp(NIVEAU_TAERSKLER[1])).toBe(2);
    expect(niveauForXp(NIVEAU_TAERSKLER[9])).toBe(10);
    expect(niveauForXp(999)).toBe(10);
  });
  it('stiger med brug — mere ved gode anmeldelser', () => {
    const s = nyt();
    registrerBrug(s, 'prematch', 'fodbold', 20);
    expect(s.niveauXp.type.prematch).toBe(1);
    registrerBrug(s, 'prematch', 'fodbold', 30);
    expect(s.niveauXp.type.prematch).toBe(3);
    expect(s.niveauer.type.prematch).toBe(2);
    expect(s.niveauer.tema.fodbold).toBe(2);
    expect(s.signaler.some((x) => x.k === 'typeNiveau')).toBe(true);
  });
  it('Hall of Fame giver +1 niveau i type og tema', () => {
    const s = nyt();
    hallOfFameBonus(s, 'livekasino', 'rigdom');
    expect(s.niveauer.type.livekasino).toBe(2);
    expect(s.niveauer.tema.rigdom).toBe(2);
    hallOfFameBonus(s, 'livekasino', 'rigdom');
    expect(s.niveauer.type.livekasino).toBe(3);
  });
  it('niveauer giver pointbonus', () => {
    const s = nyt();
    const f1 = niveauFaktor(s, 'prematch', 'fodbold', 0.04);
    s.niveauer.type.prematch = 5;
    expect(niveauFaktor(s, 'prematch', 'fodbold', 0.04)).toBeCloseTo(f1 + 0.16, 5);
  });
});
