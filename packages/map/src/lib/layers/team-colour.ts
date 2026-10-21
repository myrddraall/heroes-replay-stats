import type { PackTeamColours, Rgb } from '../pack/map-pack';

/** The colours the teams are shown in: Order's team's and Chaos's. */
export interface TeamColours {
  readonly order: Rgb;
  readonly chaos: Rgb;
}

/** The pack's colours swapped: each team in the other's, the map as from Chaos's side. */
export function swappedTeamColours(shot: PackTeamColours): TeamColours {
  return { order: shot.chaos, chaos: shot.order };
}

/** Whether these are the colours the pack's pictures were shot in: nothing to recolour. */
export function isAsShot(colours: TeamColours | null, shot: PackTeamColours): boolean {
  return (
    !colours ||
    (colours.order.every((v, i) => v === shot.order[i]) &&
      colours.chaos.every((v, i) => v === shot.chaos[i]))
  );
}

/** A key for pictures recoloured in these colours. */
export function teamColoursKey(colours: TeamColours): string {
  return `${colours.order.join(',')}/${colours.chaos.join(',')}`;
}

/**
 * Pixels (RGBA) recoloured in place from their team-colour mask's (RGBA: Order's team's amount in
 * red, Chaos's in green; PACK.md, Team colour): each team's colour as shot replaced by the one
 * wanted, in the amount the mask gives; transparency unchanged.
 */
export function applyTeamColours(
  rgba: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  shot: PackTeamColours,
  wanted: TeamColours,
): void {
  const k = shot.maskScale / 255;
  const toOrder = wanted.order.map((v, i) => (v - (shot.order[i] ?? 0)) * k);
  const toChaos = wanted.chaos.map((v, i) => (v - (shot.chaos[i] ?? 0)) * k);
  for (let p = 0; p < rgba.length; p += 4) {
    const order = mask[p] ?? 0;
    const chaos = mask[p + 1] ?? 0;
    if (!order && !chaos) continue;
    for (let i = 0; i < 3; i++) {
      rgba[p + i] = (rgba[p + i] ?? 0) + order * (toOrder[i] ?? 0) + chaos * (toChaos[i] ?? 0); // clamped by the array
    }
  }
}

/** A rectangle of a picture, and the place of its mask's in the mask's picture. */
export interface Recolouring {
  readonly source: CanvasImageSource;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly mask: CanvasImageSource;
  readonly maskX: number;
  readonly maskY: number;
}

/** A picture's rectangle in other team colours, from its mask (applyTeamColours). */
export function recolouredPicture(
  { source, x, y, w, h, mask, maskX, maskY }: Recolouring,
  shot: PackTeamColours,
  wanted: TeamColours,
): OffscreenCanvas {
  const pixels = (picture: CanvasImageSource, px: number, py: number) => {
    const canvas = new OffscreenCanvas(w, h);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser has no 2D canvas');
    context.drawImage(picture, px, py, w, h, 0, 0, w, h);
    return { canvas, context, image: context.getImageData(0, 0, w, h) };
  };
  const out = pixels(source, x, y);
  applyTeamColours(out.image.data, pixels(mask, maskX, maskY).image.data, shot, wanted);
  out.context.putImageData(out.image, 0, 0);
  return out.canvas;
}
