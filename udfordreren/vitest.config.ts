import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Flere tests kører hele spil; under CPU-belastning (fx sim-harnesset) skal de have tid nok
    testTimeout: 60_000,
  },
});
