# DECISIONS.md — Territorieduel "Markant løft"

Én linje pr. beslutning truffet autonomt undervejs (beslutning + hvorfor).

- **Branch re-point:** Sessionens branch `claude/territorieduel-feel-neon-xirilk` pegede på et urelateret elpris-dashboard; den er nulstillet til spil-basen `origin/claude/territorieduel-game-kfLqN` (1fc3cf4), da opgaven er et løft af Territorieduel.
- **Harness committes:** CLAUDE.md beskriver Node-harnessen som en procedure, ikke en fil; den er nu committet som `test/*.mjs` (kompilér-én-gang + frisk vm-realm pr. kørsel) så matrixen er reproducérbar og combo-assertions har et blivende hjem. Spillet selv er stadig én fil.
- **Testkommando:** `node --test 'test/*.test.mjs'` (Node 22 kræver glob; bare `test/` fejler som modul-load).
