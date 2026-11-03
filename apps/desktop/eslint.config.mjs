import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import { sheriffBoundaries } from '../../tools/eslint-sheriff.mjs';

export default [
  { ignores: ['out/**', 'release/**', 'app/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, parserOptions: { project: './tsconfig.json', sourceType: 'module' } },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: { ...tsPlugin.configs.recommended.rules, eqeqeq: ['error', 'always'] },
  },
  ...sheriffBoundaries,
];
