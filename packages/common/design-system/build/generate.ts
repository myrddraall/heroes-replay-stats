/**
 * Writes the design system's generated parts from their TypeScript sources: tokens.json (tokens.ts,
 * the role table in themes.ts) and the rarity block of components/bundle.css (the rest of
 * bundle.css, the components' READMEs and previews are written by hand).
 *
 *   pnpm run generate.design-system
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prettier from 'prettier';
import { rarityCss } from './themes.ts';
import { DESIGN_TOKENS } from './tokens.ts';

const root = join(import.meta.dirname, '..');

const tokensFile = join(root, 'tokens.json');
const options = await prettier.resolveConfig(tokensFile);
await writeFile(
  tokensFile,
  await prettier.format(JSON.stringify(DESIGN_TOKENS), { ...options, filepath: tokensFile }),
);
console.log(`wrote ${tokensFile}`);

const bundleFile = join(root, 'components', 'bundle.css');
const bundle = await readFile(bundleFile, 'utf8');
const start = bundle.indexOf('/* ---------- rarity themes:');
const end = bundle.indexOf('/* ---------- Angular Material mapping');
if (start < 0 || end < start) throw new Error("bundle.css has lost the rarity block's markers");
await writeFile(bundleFile, `${bundle.slice(0, start)}${rarityCss()}\n${bundle.slice(end)}`);
console.log(`wrote the rarity themes in ${bundleFile}`);
