/**
 * One role table for every theme: a role has one lightness and chroma; a theme is a hue (plus a few
 * overrides). tokens.ts takes the base themes' values from it; the rarity themes are declared in
 * bundle.css from it (`rarityCss`), because the tokens page holds at most eight themes.
 */

export const BASE_THEMES = ['purple', 'magenta', 'cyan', 'blue', 'red', 'green'] as const;
export const RARITY_THEMES = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Theme = (typeof BASE_THEMES)[number] | (typeof RARITY_THEMES)[number];
export const ALL_THEMES: readonly Theme[] = [...BASE_THEMES, ...RARITY_THEMES];

const HUE: Record<Theme, number> = {
  purple: 286,
  magenta: 328,
  cyan: 230,
  blue: 266,
  red: 18,
  green: 158,
  poor: 286,
  common: 286,
  uncommon: 142,
  rare: 250,
  epic: 306,
  legendary: 53,
};

/** role: [L%, C]. */
export const ROLES = {
  'hrs-ground': [16, 0.045],
  'hrs-tint': [19.5, 0.06],
  'hrs-tint-raised': [24, 0.075],
  'hrs-selection': [27.5, 0.09],
  'hrs-border': [58, 0.17],
  'hrs-border-strong': [68, 0.18],
  'hrs-accent': [78, 0.13],
  'hrs-glow': [66, 0.19],
  'hrs-text-muted': [80, 0.06],
  'hrs-text-dim': [66, 0.06],
  'hrs-on-accent': [16.5, 0.045],
} as const satisfies Record<string, readonly [number, number]>;
export type Role = keyof typeof ROLES;

/** Chroma multiplier: the grey rarities carry none. */
const SAT: Partial<Record<Theme, number>> = { poor: 0, common: 0 };

/** Per theme, per role: [L, C]; the glow at each hue's sRGB gamut edge, and the greys' accents. */
const OVERRIDE: Partial<Record<Theme, Partial<Record<Role, readonly [number, number]>>>> = {
  magenta: { 'hrs-glow': [66, 0.21] },
  cyan: { 'hrs-glow': [72, 0.135] },
  blue: { 'hrs-glow': [66, 0.18] },
  red: { 'hrs-glow': [66, 0.225] },
  green: { 'hrs-glow': [66, 0.15] },
  uncommon: {
    'hrs-glow': [68, 0.21],
    'hrs-accent': [84, 0.22],
    'hrs-border': [62, 0.19],
    'hrs-border-strong': [72, 0.21],
  },
  rare: {
    'hrs-glow': [64, 0.18],
    'hrs-accent': [72, 0.15],
    'hrs-border': [58, 0.16],
    'hrs-border-strong': [66, 0.18],
  },
  epic: {
    'hrs-glow': [64, 0.24],
    'hrs-accent': [74, 0.17],
    'hrs-border': [60, 0.24],
    'hrs-border-strong': [68, 0.21],
  },
  legendary: {
    'hrs-glow': [68, 0.17],
    'hrs-accent': [78, 0.145],
    'hrs-border': [62, 0.155],
    'hrs-border-strong': [70, 0.175],
  },
  poor: {
    'hrs-accent': [68, 0],
    'hrs-glow': [52, 0],
    'hrs-border': [55, 0],
    'hrs-border-strong': [60, 0],
    'hrs-text-muted': [72, 0],
  },
  common: {
    'hrs-accent': [97, 0],
    'hrs-glow': [92, 0],
    'hrs-border': [72, 0],
    'hrs-border-strong': [88, 0],
    'hrs-text-muted': [86, 0],
  },
};

/** How strongly a rarity theme glows, climbing with the tier (as written into bundle.css). */
const GLOW_K: Partial<Record<Theme, string>> = {
  poor: '0.25',
  common: '0.6',
  uncommon: '0.7',
  rare: '0.85',
  epic: '1.0',
  legendary: '1.15',
};

/** A role's colour in a theme, as `oklch(L% C H)`. */
export function roleValue(theme: Theme, role: Role): string {
  const [L, C] = OVERRIDE[theme]?.[role] ?? ROLES[role];
  return `oklch(${L}% ${(C * (SAT[theme] ?? 1)).toFixed(3)} ${HUE[theme]})`;
}

/** A theme's glows, from its glow role. */
export function themeShadows(theme: Theme): Record<string, string> {
  const g = roleValue(theme, 'hrs-glow').slice(0, -1);
  return {
    'hrs-glow-hover': `0 0 6px ${g} / 0.5)`,
    'hrs-glow-selected': `0 0 10px ${g} / 0.7), 0 0 2px ${g})`,
    'hrs-glow-panel': `0 0 14px ${g} / 0.35)`,
    'hrs-glow-modal': `0 0 40px ${g} / 0.45), 0 0 120px ${g} / 0.2)`,
  };
}

/** The rarity themes' block in bundle.css. */
export function rarityCss(): string {
  const out = [
    '/* ---------- rarity themes: the same roles as the five base themes (tokens.json), generated from one role table;',
    '   they live here only because the tokens page holds at most 8 themes. data-theme="poor|common|uncommon|rare|epic|legendary". ---------- */',
  ];
  for (const theme of RARITY_THEMES) {
    const lines = [
      ...Object.keys(ROLES).map((r) => `  --${r}: ${roleValue(theme, r as Role)};`),
      ...Object.entries(themeShadows(theme)).map(([k, v]) => `  --${k}: ${v};`),
      `  --hrs-glow-k: ${GLOW_K[theme]};`,
    ];
    out.push(`[data-theme="${theme}"] {\n${lines.join('\n')}\n}`);
  }
  return `${out.join('\n')}\n`;
}
