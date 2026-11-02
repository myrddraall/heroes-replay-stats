import { computed, Directive, input } from '@angular/core';

/**
 * A picture to show: a file (`src` alone), or one picture in a sheet of many (`src` is the sheet,
 * `rect` its place in it as `[x, y, width, height]`). The shape hero-data's `Picture` has.
 */
export interface SpritePicture {
  readonly src: string;
  readonly rect?: readonly [number, number, number, number];
}

const px = (n: number) => `${n}px`;

/**
 * Shows a picture on an `<img>`, staying an `<img>` (alt text, lazy loading, error events): a
 * file as it is, or one picture of a sheet cut out of it. `<img [hrsSprite]="icon" [spriteWidth]="32"
 * alt="">`. The `<img>` is sized to the picture in the sheet and shows that part of it
 * (`object-fit: none`, `object-position`), then `zoom` scales it to `spriteWidth` pixels wide or
 * `spriteHeight` pixels high (the other side follows). Without either, a sheet's picture shows at
 * its own size and a file is sized by the page's CSS. `zoom`, unlike `transform: scale`, scales
 * the space it takes too.
 */
@Directive({
  selector: 'img[hrsSprite]',
  host: {
    '[src]': 'hrsSprite().src',
    '[attr.loading]': 'loading()',
    'decoding': 'async',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.object-fit]': 'rect() ? "none" : null',
    '[style.object-position]': 'position()',
    '[style.zoom]': 'zoom()',
  },
})
export class Sprite {
  readonly hrsSprite = input.required<SpritePicture>();
  /** The width to show it at, in CSS pixels; its own width (a sheet's picture) or the CSS's (a file) when not set. */
  readonly spriteWidth = input<number>();
  /** The height to show it at instead, in CSS pixels (pictures of one height but varied widths, such as emotes). */
  readonly spriteHeight = input<number>();
  /** `lazy` unless the picture is needed at once. */
  readonly loading = input<'lazy' | 'eager'>('lazy');

  protected readonly rect = computed(() => this.hrsSprite().rect ?? null);

  protected readonly width = computed(() => {
    const rect = this.rect();
    if (rect) return px(rect[2]);
    const width = this.spriteWidth();
    return width === undefined ? null : px(width);
  });

  protected readonly height = computed(() => {
    const rect = this.rect();
    if (rect) return px(rect[3]);
    const height = this.spriteHeight();
    return height === undefined || this.spriteWidth() !== undefined ? null : px(height);
  });

  protected readonly position = computed(() => {
    const rect = this.rect();
    return rect ? `${px(-rect[0])} ${px(-rect[1])}` : null;
  });

  protected readonly zoom = computed(() => {
    const rect = this.rect();
    if (!rect) return null;
    const width = this.spriteWidth();
    if (width !== undefined) return String(width / rect[2]);
    const height = this.spriteHeight();
    return height !== undefined ? String(height / rect[3]) : null;
  });
}
