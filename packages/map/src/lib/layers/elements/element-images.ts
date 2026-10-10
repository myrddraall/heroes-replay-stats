import type { MapAssets } from '../../pack/map-assets';
import type { ElementAtlasName, ElementCut, HiddenByMask, PackElements } from '../../pack/map-pack';
import type { HitImage } from './element-pieces';

/** The two levels of detail the cut-outs come in (PACK.md, Elements: the atlases). */
export type ElementLevel = 'small' | 'full';

/** A cut-out's picture as it is drawn: a source, and the rectangle of it to draw. */
export interface ElementPicture {
  readonly source: CanvasImageSource;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A picture's transparency, one byte a pixel. */
function alphaOf(picture: ElementPicture): HitImage {
  const { w, h } = picture;
  const canvas = new OffscreenCanvas(w, h);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser has no 2D canvas');
  context.drawImage(picture.source, picture.x, picture.y, w, h, 0, 0, w, h);
  const rgba = context.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
  return { width: w, height: h, alpha };
}

/**
 * One pack's element pictures, from its atlases: the `small` one (every state at the map's
 * overview scale, for the zoomed-out view) is read at once; `standing` and `masks` when the full
 * level is first wanted, `rubble` when a fallen structure is first shown at it. `loaded` is called
 * as each atlas arrives. An atlas that can't be read leaves its cut-outs undrawn.
 */
export class ElementImages {
  private readonly atlases = new Map<ElementAtlasName, ImageBitmap>();
  private readonly requested = new Set<ElementAtlasName>();
  private readonly failed = new Set<ElementAtlasName>();
  private readonly composed = new Map<ElementCut, { key: string; canvas: OffscreenCanvas }>();
  private readonly hits = new Map<ElementCut, { level: ElementLevel; image: HitImage }>();
  private readonly abort = new AbortController();

  constructor(
    private readonly assets: MapAssets,
    private readonly elements: PackElements,
    private readonly loaded: () => void,
  ) {
    this.request('small', 'high');
  }

  /** The small level's pixels per map layer pixel. */
  get smallScale(): number {
    return this.elements.atlases.small?.scale ?? 1;
  }

  /** Whether a level can be drawn: its atlas (for the full level, the standing one) has arrived. */
  has(level: ElementLevel): boolean {
    return this.atlases.has(this.atlasOf(level));
  }

  /** Whether a level's request is over: its atlas arrived, couldn't be read, or the pack has none. */
  ready(level: ElementLevel): boolean {
    const name = this.atlasOf(level);
    return this.atlases.has(name) || this.failed.has(name) || !this.elements.atlases[name];
  }

  private atlasOf(level: ElementLevel): ElementAtlasName {
    return level === 'small' ? 'small' : 'standing';
  }

  /** Asks for the full level's atlases: standing and masks, and rubble when a fallen one is shown. */
  wantFull(rubble: boolean): void {
    this.request('standing', 'low');
    this.request('masks', 'low');
    if (rubble) this.request('rubble', 'low');
  }

  private request(name: ElementAtlasName, priority: 'high' | 'low'): void {
    const atlas = this.elements.atlases[name];
    if (!atlas || this.requested.has(name)) return;
    this.requested.add(name);
    this.assets
      .picture(atlas.file, this.abort.signal, priority)
      .then((bitmap) => {
        if (this.abort.signal.aborted) return bitmap.close();
        this.atlases.set(name, bitmap);
        this.composed.clear();
        this.loaded();
      })
      .catch(() => {
        this.failed.add(name);
        this.loaded();
      });
  }

  /**
   * A cut-out at a level, with (at the full level) the parts erased where the given masks'
   * neighbours stand in front of it; the composed picture kept until the masks change.
   * `undefined` until the atlas it is in has loaded.
   */
  picture(
    cut: ElementCut,
    masks: readonly HiddenByMask[],
    level: ElementLevel,
  ): ElementPicture | undefined {
    const [, , w, h] = cut.rect;
    if (level === 'small') {
      const atlas = this.atlases.get('small');
      if (!atlas) return undefined;
      const s = this.smallScale;
      return {
        source: atlas,
        x: cut.small[0],
        y: cut.small[1],
        w: Math.ceil(w * s),
        h: Math.ceil(h * s),
      };
    }
    const atlas = this.atlases.get(cut.atlas);
    if (!atlas) return undefined;
    const whole: ElementPicture = { source: atlas, x: cut.at[0], y: cut.at[1], w, h };
    const maskAtlas = this.atlases.get('masks');
    if (!maskAtlas || !masks.length) return whole;
    const key = masks.map((m) => m.id).join(',');
    const kept = this.composed.get(cut);
    if (kept?.key === key) return { source: kept.canvas, x: 0, y: 0, w, h };
    const canvas = new OffscreenCanvas(w, h);
    const context = canvas.getContext('2d');
    if (!context) return whole;
    context.drawImage(atlas, cut.at[0], cut.at[1], w, h, 0, 0, w, h);
    context.globalCompositeOperation = 'destination-out';
    for (const mask of masks)
      context.drawImage(maskAtlas, mask.at[0], mask.at[1], w, h, 0, 0, w, h);
    this.composed.set(cut, { key, canvas });
    return { source: canvas, x: 0, y: 0, w, h };
  }

  /** A cut-out's transparency, for hit-testing: at the full level once it has loaded, else the small. */
  hit(cut: ElementCut): HitImage | undefined {
    const level: ElementLevel = this.atlases.has(cut.atlas) ? 'full' : 'small';
    const kept = this.hits.get(cut);
    if (kept?.level === level) return kept.image;
    const picture = this.picture(cut, [], level);
    if (!picture) return undefined;
    const image = alphaOf(picture);
    this.hits.set(cut, { level, image });
    return image;
  }

  /** Stops what's still loading and frees the pictures. */
  dispose(): void {
    this.abort.abort();
    for (const bitmap of this.atlases.values()) bitmap.close();
    this.atlases.clear();
    this.hits.clear();
    this.composed.clear();
  }
}
