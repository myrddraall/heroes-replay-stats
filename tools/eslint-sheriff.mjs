// @ts-check
import sheriff from '@softarc/eslint-plugin-sheriff';

/**
 * Sheriff's module-boundary rules (dependency rules and encapsulation, from the root
 * `sheriff.config.ts`), for a package's ESLint config to spread in. Warnings while the
 * domain-packages conversion is under way; errors once its baseline is clear.
 */
export const sheriffBoundaries = [
  {
    ...sheriff.configs.all,
    files: ['**/*.ts'],
    rules: {
      '@softarc/sheriff/dependency-rule': 'warn',
      '@softarc/sheriff/encapsulation': 'warn',
    },
  },
];
