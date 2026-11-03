/**
 * Checks the contrast of every text, border and focus colour on the surfaces they sit on, in every
 * theme (the role table's, the rarity themes included): 4.5:1 for text, 3:1 for lines and dim
 * text, solid and as a film (hrs-tint at its floor over a bright patch of the scene). Fails when any
 * pair falls short.
 *
 *   pnpm run check.contrast
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hexToRgb, roundHalfEven, toHex } from './oklab.ts';
import { ALL_THEMES, type Role, ROLES, roleValue, type Theme } from './themes.ts';

interface Token {
  readonly name: string;
  readonly value: string | Readonly<Record<string, string>>;
}

const tokens = JSON.parse(await readFile(join(import.meta.dirname, '..', 'tokens.json'), 'utf8')) as {
  color: { tokens: Token[] };
};
const byName = new Map(tokens.color.tokens.map((t) => [t.name, t.value]));

function colour(name: string, theme: Theme): string {
  if (name in ROLES) return toHex(roleValue(theme, name as Role));
  const v = byName.get(name);
  if (v === undefined) throw new Error(`no token ${name}`);
  return toHex(typeof v === 'string' ? v : (v[theme] ?? v['purple']!));
}

const luminance = (hex: string) => {
  const f = (u: number) => (u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hexToRgb(hex).map(f) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** `fg` at `alpha` over `bg`. */
const over = (fg: string, alpha: number, bg: string) => {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return `#${f.map((x, i) => roundHalfEven((x * alpha + b[i]! * (1 - alpha)) * 255).toString(16).padStart(2, '0')).join('')}`;
};

/** A bright nebula patch behind a film at its floor. */
const BRIGHT = '#4a3a8a';
const PAIRS: readonly [string, number][] = [
  ['hrs-text', 4.5],
  ['hrs-text-muted', 4.5],
  ['hrs-accent', 4.5],
  ['hrs-border', 3],
  ['hrs-border-strong', 3],
  ['hrs-text-dim', 3],
  ['hrs-focus', 3],
  ['hrs-team-blue', 4.5],
  ['hrs-team-red', 4.5],
  ['hrs-self', 4.5],
  ['hrs-gold', 4.5],
  ['hrs-error', 4.5],
  ['hrs-info', 4.5],
  ['hrs-warning', 4.5],
];

let failures = 0;
for (const theme of ALL_THEMES) {
  for (const ground of ['hrs-tint', 'hrs-tint-raised', 'hrs-selection']) {
    const solid = colour(ground, theme);
    const film = ground === 'hrs-tint' ? over(solid, 0.72, BRIGHT) : solid;
    for (const [name, need] of PAIRS) {
      if (name === 'hrs-border' && ground === 'hrs-selection') continue;
      if (name === 'hrs-text-dim' && ground !== 'hrs-tint') continue;
      for (const [label, bg] of [['solid', solid], ['film', film]] as const) {
        const r = ratio(colour(name, theme), bg);
        if (r < need) {
          failures++;
          console.log(`FAIL ${theme.padEnd(6)} ${name.padEnd(24)} on ${ground.padEnd(16)} ${label.padEnd(5)} ${r.toFixed(2)} < ${need}`);
        }
      }
    }
  }
  const r = ratio(colour('hrs-on-accent', theme), colour('hrs-accent', theme));
  if (r < 4.5) {
    failures++;
    console.log(`FAIL ${theme} on-accent ${r.toFixed(2)}`);
  }
}
console.log(`failures: ${failures}`);
if (failures) process.exitCode = 1;
