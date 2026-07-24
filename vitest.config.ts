import { defineConfig } from 'vitest/config';

// Cobre a lógica de domínio pura do monorepo (Node). O app Angular usa `ng test`
// à parte (Karma/browser), fora deste runner.
export default defineConfig({
  test: {
    include: ['packages/shared/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    environment: 'node',
  },
});
