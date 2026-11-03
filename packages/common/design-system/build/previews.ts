/**
 * The previews as pages to open in a browser, in the repository's tmp/design-system-harness
 * (git-ignored): each component's preview.html with the tokens (as tokens.css, the type styles as
 * classes) and bundle.css linked, and index.html with every preview in a frame.
 *
 *   pnpm run generate.design-system-previews
 */
import { mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Token {
  readonly name: string;
  readonly value: string | Readonly<Record<string, string>>;
}
interface Tokens {
  readonly name: string;
  readonly color: { readonly themes: readonly { id: string }[]; readonly tokens: readonly Token[] };
  readonly shadow: { readonly tokens: readonly Token[] };
  readonly type: {
    readonly families: Readonly<Record<string, string>>;
    readonly groups: readonly {
      readonly family: string;
      readonly styles: readonly {
        readonly name: string;
        readonly family?: string;
        readonly fontSize: string;
        readonly lineHeight?: string;
        readonly fontWeight?: number;
        readonly letterSpacing?: string;
      }[];
    }[];
  };
  readonly [family: string]: unknown;
}

const root = join(import.meta.dirname, '..');
const out = join(root, '..', '..', '..', 'tmp', 'design-system-harness');

const t = JSON.parse(await readFile(join(root, 'tokens.json'), 'utf8')) as Tokens;
const themes = t.color.themes.map((x) => x.id);
const first = themes[0]!;
const value = (token: Token, theme: string) =>
  typeof token.value === 'string' ? token.value : (token.value[theme] ?? token.value[first]);

const css = [`/* ${t.name} — generated from tokens.json (local harness copy) */`];
for (const theme of themes) {
  const selector = theme === first ? `:root, [data-theme="${theme}"]` : `[data-theme="${theme}"]`;
  const lines = [...t.color.tokens, ...t.shadow.tokens].map((x) => `  --${x.name}: ${value(x, theme)};`);
  css.push(`${selector} {\n${lines.join('\n')}\n}`);
}
const other = (['spacing', 'radius', 'opacity', 'effect'] as const).flatMap((family) =>
  (t[family] as { tokens: Token[] }).tokens.map((x) => `  --${x.name}: ${value(x, first)};`),
);
other.push(...Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`));
css.push(`:root {\n${other.join('\n')}\n}`);
for (const group of t.type.groups)
  for (const s of group.styles) {
    const props = [
      `font-family: var(--font-${s.family ?? group.family})`,
      `font-size: ${s.fontSize}`,
      `line-height: ${s.lineHeight ?? 'normal'}`,
      `font-weight: ${s.fontWeight ?? 400}`,
      ...(s.letterSpacing === undefined ? [] : [`letter-spacing: ${s.letterSpacing}`]),
    ];
    css.push(`.${s.name} { ${props.join('; ')}; }`);
  }

await mkdir(out, { recursive: true });
await rm(join(out, 'bundle.css'), { force: true });
await symlink(join(root, 'components', 'bundle.css'), join(out, 'bundle.css'));
await writeFile(join(out, 'tokens.css'), `${css.join('\n')}\n`);

const heightOf = (html: string) => Number(/height=(\d+)/.exec(html)?.[1] ?? 120);
const names = (await readdir(join(root, 'components'), { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const frames: string[] = [];
for (const name of names) {
  const html = await readFile(join(root, 'components', name, 'preview.html'), 'utf8').catch(() => null);
  if (html === null) continue;
  await writeFile(
    join(out, `${name}.html`),
    html
      .replace('<head>', '<head><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="bundle.css">')
      .replace('<html lang="en">', `<html lang="en" data-theme="${first}">`),
  );
  frames.push(
    `<h3>${name}</h3><iframe src="${name}.html" style="width:100%;height:${heightOf(html) + 40}px;border:0"></iframe>`,
  );
}
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#111;color:#ddd;font:13px sans-serif;margin:16px}h3{margin:18px 0 4px}</style></head><body>${frames.join('')}</body></html>`,
);
console.log(`previews: ${frames.length} in ${out}`);
