// @ts-check
import sheriff from '@softarc/eslint-plugin-sheriff';

/**
 * Sheriff's module-boundary rules (dependency rules and encapsulation, from the root
 * `sheriff.config.ts`), for a package's ESLint config to spread in, as errors. aether's own config
 * turns its encapsulation back to a warning until it moves to its own repo.
 */
export const sheriffBoundaries = [
  {
    ...sheriff.configs.all,
    files: ['**/*.ts'],
    rules: {
      '@softarc/sheriff/dependency-rule': 'error',
      '@softarc/sheriff/encapsulation': 'error',
    },
  },
];
