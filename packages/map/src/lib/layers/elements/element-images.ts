import type { ElementCut, HiddenByMask } from '../../pack/map-pack';
import type { MapAssets } from '../../pack/map-assets';
import type { ElementPiece, HitImage } from './element-pieces';

/** A picture's transparency, one byte a pixel. */
function alphaOf(bitmap: ImageBitmap): HitImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser has no 2D canvas');
  context.drawImage(bitmap, 0, 0);
  const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const alpha = new Uint8Array(bitmap.width * bitmap.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
  return { width: bitmap.width, height: bitmap.height, alpha };
}

/**
 * One pack's element pictures: each state's cut-out, the masks of the neighbours in front of it,
 * and each piece's hit picture's transparency. Read all at once from the map's assets; `loaded`
 * is called as each one arrives. A picture that can't be read is left out.
 */
export class ElementImages {
  private readonly cuts = new Map<ElementCut, ImageBitmap>();
  private readonly masks = new Map<HiddenByMask, ImageBitmap>();
  private readonly hits = new Map<ElementCut, HitImage>();
  private readonly composed = new Map<ElementCut, { key: string; canvas: OffscreenCanvas }>();
  private readonly abort = new AbortController();

  constructor(assets: MapAssets, pieces: readonly ElementPiece[], loaded: () => void) {
    const fetchBitmap = (file: string) => assets.picture(file, this.abort.signal);
    for (const piece of pieces) {
      for (const cut of Object.values(piece.states)) {
        if (!cut) continue; // nothing left of it in that state
        fetchBitmap(cut.file)
          .then((bitmap) => {
            this.cuts.set(cut, bitmap);
            if (cut === piece.hit) this.hits.set(cut, alphaOf(bitmap));
            loaded();
          })
          .catch(() => undefined);
        for (const mask of cut.hiddenBy ?? []) {
          fetchBitmap(mask.file)
            .then((bitmap) => {
              this.masks.set(mask, bitmap);
              loaded();
            })
            .catch(() => undefined);
        }
      }
    }
  }

  hit(cut: ElementCut): HitImage | undefined {
    return this.hits.get(cut);
  }

  /**
   * A cut-out as it is drawn: with the parts erased where the given masks' neighbours stand in
   * front of it; the result kept until the masks change. `undefined` until it has loaded.
   */
  picture(cut: ElementCut, masks: readonly HiddenByMask[]): CanvasImageSource | undefined {
    const bitmap = this.cuts.get(cut);
    if (!bitmap) return undefined;
    const loaded = masks.filter((m) => this.masks.has(m));
    if (!loaded.length) return bitmap;
    const key = loaded.map((m) => m.id).join(',');
    const kept = this.composed.get(cut);
    if (kept?.key === key) return kept.canvas;
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) return bitmap;
    context.drawImage(bitmap, 0, 0);
    context.globalCompositeOperation = 'destination-out';
    for (const mask of loaded) {
      const picture = this.masks.get(mask);
      if (picture) context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    }
    this.composed.set(cut, { key, canvas });
    return canvas;
  }

  /** Stops what's still loading and frees the pictures. */
  dispose(): void {
    this.abort.abort();
    for (const bitmap of [...this.cuts.values(), ...this.masks.values()]) bitmap.close();
    this.cuts.clear();
    this.masks.clear();
    this.hits.clear();
    this.composed.clear();
  }
}
