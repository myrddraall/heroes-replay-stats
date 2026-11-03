/** The neutral themes the site can wear: the game's violet, its ColorPurple magenta, or cyan. */
export type NeutralTheme = 'purple' | 'magenta' | 'cyan';
export const NEUTRAL_THEMES: readonly NeutralTheme[] = ['purple', 'magenta', 'cyan'];

/**
 * Every theme an element can carry (`data-theme`): the neutrals, then the ones the data sets: the
 * teams, the user's own player, and the item tiers.
 */
export type ThemeName =
  | NeutralTheme
  | 'blue'
  | 'red'
  | 'green'
  | 'poor'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

/** The look every page shares. */
export interface ThemeSettings {
  readonly theme: NeutralTheme;
  /** How solid every film is, from its legibility floor (0) to solid (1). */
  readonly opacity: number;
  /** Whether the films blur what is behind them. */
  readonly blur: boolean;
}

export const DEFAULT_THEME: ThemeSettings = { theme: 'purple', opacity: 0, blur: false };

/** The glass theme's names for the neutrals, as saved before. */
const EARLIER_THEMES: Readonly<Record<string, NeutralTheme>> = { neutral: 'purple', nexus: 'cyan' };

function theme(v: unknown): NeutralTheme | undefined {
  if (typeof v !== 'string') return undefined;
  return NEUTRAL_THEMES.find((t) => t === v) ?? EARLIER_THEMES[v];
}

function opacity(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(1, Math.max(0, Math.round(v * 100) / 100));
}

/**
 * What the user chose, each value kept within its range; one that isn't a value is left out, and
 * so is anything else saved with them (the glass theme's opacities).
 */
export function validTheme(saved: Readonly<Record<string, unknown>>): Partial<ThemeSettings> {
  const chosen: Partial<Record<keyof ThemeSettings, unknown>> = {
    theme: theme(saved['theme']),
    opacity: opacity(saved['opacity']),
    blur: typeof saved['blur'] === 'boolean' ? saved['blur'] : undefined,
  };
  return Object.fromEntries(
    Object.entries(chosen).filter(([, v]) => v !== undefined),
  ) as Partial<ThemeSettings>;
}
