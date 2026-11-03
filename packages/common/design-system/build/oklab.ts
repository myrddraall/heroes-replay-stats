/** OKLab / OKLCH ⇄ sRGB, for the role table and the contrast check (Björn Ottosson's matrices). */

type Rgb = readonly [number, number, number];

const srgbToLinear = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace(/^#/, '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as Rgb;
}

function rgbToOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Linear sRGB of an OKLab colour, unclamped. */
function oklabToLinear(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** An OKLCH colour as [L 0..1, C, H degrees]. */
export function hexToOklch(hex: string): Rgb {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return [L, Math.hypot(a, b), (((Math.atan2(b, a) * 180) / Math.PI) % 360 + 360) % 360];
}

/** Rounds halves to even, as the role table's hex values were first worked out. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** An OKLCH colour in sRGB hex, its chroma shrunk until it is in gamut. */
export function oklchToHex(L: number, C: number, H: number): string {
  let a = C * Math.cos((H * Math.PI) / 180);
  let b = C * Math.sin((H * Math.PI) / 180);
  for (let k = 0; k < 40; k++) {
    const raw = oklabToLinear(L, a, b).map((x) => (x > 0 ? linearToSrgb(x) : -1));
    if (raw.every((x) => x >= -0.002 && x <= 1.002)) break;
    a *= 0.97;
    b *= 0.97;
  }
  const rgb = oklabToLinear(L, a, b).map((x) => Math.min(1, Math.max(0, linearToSrgb(Math.max(0, x)))));
  return `#${rgb.map((x) => roundHalfEven(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** `oklch(L% C H)`, as tokens.json writes a colour given in hex. */
export function formatOklch([L, C, H]: Rgb): string {
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

/** A token colour (`oklch(…)` or hex) in sRGB hex. */
export function toHex(value: string): string {
  if (value.startsWith('#')) return value;
  const m = /oklch\(([\d.]+)% ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(value);
  if (!m) throw new Error(`not a colour: ${value}`);
  return oklchToHex(Number(m[1]) / 100, Number(m[2]), Number(m[3]));
}
