/**
 * One role table for every theme: a role has one lightness and chroma; a theme is a hue (plus a few
 * overrides). tokens.ts takes the base themes' values from it; the rarity themes are declared in
 * bundle.css from it (`rarityCss`), because the tokens page holds at most eight themes.
 */

export const BASE_THEMES = [
  'purple',
  'magenta',
  'cyan',
  'blue',
  'red',
  'self',
  'blue-self',
  'red-self',
] as const;
export const RARITY_THEMES = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Theme = (typeof BASE_THEMES)[number] | (typeof RARITY_THEMES)[number];

/**
 * Other names for a theme, with no values of their own: the generated CSS adds each alias to every
 * selector that names its theme. None at present (the self rows are themes of their own, below).
 */
export const THEME_ALIASES = {} as const satisfies Readonly<Record<string, Theme>>;
export const ALL_THEMES: readonly Theme[] = [...BASE_THEMES, ...RARITY_THEMES];

/** The self rows' gold: the design system's hrs-gold (#f2b632), hue 79. */
const GOLD_HUE = 79;

const HUE: Record<Theme, number> = {
  purple: 286,
  magenta: 328,
  cyan: 230,
  blue: 266,
  red: 18,
  // the game's self green (the profile frame's _self, the score screen's self overlay: hue 135–138)
  self: 137,
  // the self rows' grounds; their accents come from SELF_ROW
  'blue-self': 266,
  'red-self': 18,
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
  self: { 'hrs-glow': [66, 0.2] },
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

/** The roles that are a theme's grounds: the surfaces things sit on, rather than its colour. */
const GROUND_ROLES: ReadonlySet<Role> = new Set([
  'hrs-ground',
  'hrs-tint',
  'hrs-tint-raised',
  'hrs-selection',
]);

/**
 * The user's own row, as the game's score screens draw it (the PlayerBG_Gold overlay over the
 * team's row): the team's grounds with the self colour for everything else, green on the blue
 * side and gold on the red. Each accent role is the given hue at its [L, C].
 */
const SELF_ROW: Partial<
  Record<Theme, { readonly hue: number; readonly roles: Readonly<Record<Exclude<Role, 'hrs-ground' | 'hrs-tint' | 'hrs-tint-raised' | 'hrs-selection'>, readonly [number, number]>> }>
> = {
  'blue-self': {
    hue: HUE.self,
    roles: {
      'hrs-border': ROLES['hrs-border'],
      'hrs-border-strong': ROLES['hrs-border-strong'],
      'hrs-accent': ROLES['hrs-accent'],
      'hrs-glow': [66, 0.2],
      'hrs-text-muted': ROLES['hrs-text-muted'],
      'hrs-text-dim': ROLES['hrs-text-dim'],
      'hrs-on-accent': ROLES['hrs-on-accent'],
    },
  },
  'red-self': {
    hue: GOLD_HUE,
    roles: {
      'hrs-border': [66, 0.14],
      'hrs-border-strong': [74, 0.15],
      'hrs-accent': [82, 0.15],
      'hrs-glow': [78, 0.16],
      'hrs-text-muted': [84, 0.06],
      'hrs-text-dim': [70, 0.06],
      'hrs-on-accent': [18, 0.04],
    },
  },
};

/** A role's colour in a theme, as `oklch(L% C H)`. */
export function roleValue(theme: Theme, role: Role): string {
  const self = SELF_ROW[theme];
  if (self && !GROUND_ROLES.has(role)) {
    const [L, C] = self.roles[role as keyof typeof self.roles];
    return `oklch(${L}% ${C.toFixed(3)} ${self.hue})`;
  }
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
    '   they live here only because the tokens page holds at most 8 themes. theme="poor|common|uncommon|rare|epic|legendary". ---------- */',
  ];
  for (const theme of RARITY_THEMES) {
    const lines = [
      ...Object.keys(ROLES).map((r) => `  --${r}: ${roleValue(theme, r as Role)};`),
      ...Object.entries(themeShadows(theme)).map(([k, v]) => `  --${k}: ${v};`),
      `  --hrs-glow-k: ${GLOW_K[theme]};`,
    ];
    out.push(`[theme="${theme}"] {\n${lines.join('\n')}\n}`);
  }
  return `${out.join('\n')}\n`;
}
