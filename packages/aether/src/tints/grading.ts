import {
  type ColourTint,
  onLight,
  switchedOn,
  type ThemeTint,
  type TintLayer,
  type TintsSet,
  type ToneRange,
} from './tint-layers';
import { parseCanvasColour, type TintBlend } from './tints';

/**
 * A scene's colour grading as drawn: its tints switched on, in order, those on the light (graded in
 * HDR, before tone mapping) apart from those on the picture as shown (a theme's colour resolved to
 * its own: a colour fill).
 */
export interface Grading {
  readonly light: readonly TintLayer[];
  readonly picture: readonly TintLayer[];
}

export const NO_GRADING: Grading = { light: [], picture: [] };

/** How many of a grading's tints are drawn at most, on the light and on the picture each. */
export const MAX_GRADES = 8;

/**
 * A scene's grading as drawn (`theme`: a theme's colour as a colour fill, or none where its preset
 * has no colour).
 */
export function gradingOf(
  set: TintsSet | undefined,
  theme: (t: ThemeTint) => ColourTint | null,
): Grading {
  const on = switchedOn(set);
  return {
    light: on.filter((t) => onLight(t.kind)).slice(0, MAX_GRADES),
    picture: on
      .filter((t) => !onLight(t.kind))
      .flatMap((t): TintLayer[] => {
        const drawn = t.kind === 'theme' ? theme(t) : t;
        return drawn ? [drawn] : [];
      })
      .slice(0, MAX_GRADES),
  };
}

/** A colour (channels 0 to 1) as `#rrggbb`. */
export function hexOf(rgb: readonly [number, number, number]): string {
  const byte = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${rgb.map(byte).join('')}`;
}

/** A colour blended over the whole picture, as a grading's (the site's tint: its theme's colour). */
export function pictureTint(colour: string, blend: TintBlend, strength = 1): ColourTint {
  return { id: 'tint', kind: 'colour', colour, blend, strength };
}

export function sameGrading(a: Grading, b: Grading): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** A grading's tints with those on the light first (they are graded first), each side in its order. */
export function lightFirst(tints: readonly TintLayer[]): readonly TintLayer[] {
  return [...tints.filter((t) => onLight(t.kind)), ...tints.filter((t) => !onLight(t.kind))];
}

const luminance = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;

/**
 * A black body's colour at a temperature (kelvin), as sRGB 0 to 1 (Tanner Helland's fit of the
 * CIE 1964 colour matching functions, from 1000 K to 40000 K).
 */
export function blackBody(kelvin: number): [number, number, number] {
  const t = Math.min(400, Math.max(10, kelvin / 100));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g =
    t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.min(1, Math.max(1 / 255, v / 255));
  return [c(r), c(g), c(b)];
}

/**
 * White balance as a multiplier of each channel: the light of `temperature` made white (as light at
 * 6500 K is), leaned to magenta (`tint` 1) or green (-1); its brightness kept.
 */
export function whiteBalance(temperature: number, tint: number): [number, number, number] {
  const white = blackBody(6500);
  const light = blackBody(temperature);
  const m = white.map((w, i) => w / light[i]!);
  const leaned = [m[0]! * (1 + 0.2 * tint), m[1]! * (1 - 0.2 * tint), m[2]! * (1 + 0.2 * tint)];
  const l = luminance(leaned);
  return leaned.map((v) => v / l) as [number, number, number];
}

/**
 * A lift/gamma/gain range as each channel's value: its amount, leaned toward its colour (the
 * colour's brightness taken out: white leans none).
 */
export function toneRange(range: ToneRange): [number, number, number] {
  const c = parseCanvasColour(range.colour) ?? [1, 1, 1];
  const l = luminance(c);
  return c.map((v) => range.amount * (1 + v - l)) as [number, number, number];
}

/** The scene's Colour kept before scenes were graded: one colour over all of them. */
interface KeptColour {
  readonly background?: { readonly on?: boolean; readonly colour?: string; readonly blend?: TintBlend };
  /** A theme preset's id, or 'custom' (set by hand). */
  readonly choice?: string;
}

/**
 * The scenes' one Colour kept before they were graded, as the tint each scene's grading starts
 * with: the theme colour it was chosen as, or the colour set by hand; none where it was off.
 */
export function keptColourTint(kept: KeptColour | undefined): TintLayer | null {
  const b = kept?.background;
  if (!b?.on) return null;
  if (kept?.choice && kept.choice !== 'custom')
    return { id: 'colour', kind: 'theme', strength: 1, preset: kept.choice };
  return { ...pictureTint(b.colour ?? '#ffffff', b.blend ?? 'multiply'), id: 'colour' };
}
