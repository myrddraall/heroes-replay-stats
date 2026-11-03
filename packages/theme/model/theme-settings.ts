/** The neutral the site is in: the game's purples with magenta, or the Nexus blue with cyan. */
export type ThemeName = 'neutral' | 'nexus';
export const THEME_NAMES: readonly ThemeName[] = ['neutral', 'nexus'];

/** The look every page shares. */
export interface ThemeSettings {
  readonly theme: ThemeName;
  /** How see-through the glass panels are (their opacity). */
  readonly glassAlpha: number;
  /** How see-through the frame is (the menu and the header). */
  readonly frameAlpha: number;
  /** Whether the glass blurs what is behind it: redone for every frame of the background. */
  readonly blur: boolean;
}

/** The glass opacity below which muted text loses WCAG AA contrast over the background's brightest sky. */
export const GLASS_ALPHA_RANGE = { min: 0.06, max: 1 } as const;

export const DEFAULT_THEME: ThemeSettings = {
  theme: 'neutral',
  glassAlpha: 0.5,
  frameAlpha: 0.55,
  blur: false,
};

function alpha(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const { min, max } = GLASS_ALPHA_RANGE;
  return Math.min(max, Math.max(min, Math.round(v * 100) / 100));
}

/** What the user chose, each value kept within its range; one that isn't a value is left out. */
export function validTheme(saved: Partial<Record<keyof ThemeSettings, unknown>>): Partial<ThemeSettings> {
  const chosen: Partial<Record<keyof ThemeSettings, unknown>> = {
    theme: THEME_NAMES.find((t) => t === saved.theme),
    glassAlpha: alpha(saved.glassAlpha),
    frameAlpha: alpha(saved.frameAlpha),
    blur: typeof saved.blur === 'boolean' ? saved.blur : undefined,
  };
  return Object.fromEntries(
    Object.entries(chosen).filter(([, v]) => v !== undefined),
  ) as Partial<ThemeSettings>;
}
