/**
 * Writes the design system's generated part from its TypeScript source: tokens.json (tokens.ts).
 * components/bundle.css, the components' READMEs and previews are written by hand; the colours are
 * the cp-theming theme's (apps/web/src/theme.scss).
 *
 *   pnpm run generate.design-system
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prettier from 'prettier';
import { DESIGN_TOKENS } from './tokens.ts';

const root = join(import.meta.dirname, '..');

const tokensFile = join(root, 'tokens.json');
const options = await prettier.resolveConfig(tokensFile);
await writeFile(
  tokensFile,
  await prettier.format(JSON.stringify(DESIGN_TOKENS), { ...options, filepath: tokensFile }),
);
console.log(`wrote ${tokensFile}`);
