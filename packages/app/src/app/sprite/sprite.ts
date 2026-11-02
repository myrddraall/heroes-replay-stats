import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { parseSheetName, SheetStore } from '../sheet/sheet.store';

/**
 * A picture to show: a file (`src` alone), or one picture in a sheet of many (`src` is the sheet,
 * `rect` its place in it as `[x, y, width, height]`). The shape hero-data's `Picture` has.
 */
export interface SpritePicture {
  readonly src: string;
  readonly rect?: readonly [number, number, number, number];
}

const px = (n: number) => `${n}px`;

/** How far ahead of the viewport a lazy sheet starts loading, as `loading="lazy"` images do. */
const LAZY_MARGIN = '300px';

/**
 * Shows a picture on an `<img>`, staying an `<img>` (alt text, lazy loading, error events): a
 * file as it is, or one picture of a sheet cut out of it. `<img [hrsSprite]="icon" [spriteWidth]="32"
 * alt="">`, or a picture a sheet names in its own metadata, `<img hrsSprite="validation#settings">`
 * (the sheet loaded once for every picture in it, through `SheetStore`; with `loading="lazy"`,
 * only once the image nears the viewport). The `<img>` is sized to the picture in the sheet and
 * shows that part of it (`object-fit: none`, `object-position`), then `zoom` scales it to
 * `spriteWidth` pixels wide or `spriteHeight` pixels high (the other side follows). Without either,
 * a sheet's picture shows at its own size and a file is sized by the page's CSS. `zoom`, unlike
 * `transform: scale`, scales the space it takes too.
 */
@Directive({
  selector: 'img[hrsSprite]',
  host: {
    '[attr.src]': 'picture()?.src ?? null',
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
  /** The picture: as an object, or a sheet's picture by name (`sheet#picture`). */
  readonly hrsSprite = input.required<SpritePicture | string>();
  /** The width to show it at, in CSS pixels; its own width (a sheet's picture) or the CSS's (a file) when not set. */
  readonly spriteWidth = input<number>();
  /** The height to show it at instead, in CSS pixels (pictures of one height but varied widths, such as emotes). */
  readonly spriteHeight = input<number>();
  /** `lazy` unless the picture is needed at once. */
  readonly loading = input<'lazy' | 'eager'>('lazy');

  private readonly store = inject(SheetStore);
  /** Whether the image is near the viewport (always, where the browser can't tell). */
  private readonly near = signal(typeof IntersectionObserver === 'undefined');

  /** The picture to show: as given, or a sheet's by name once its sheet has loaded. */
  protected readonly picture = computed((): SpritePicture | null => {
    const given = this.hrsSprite();
    if (typeof given !== 'string') return given;
    const { sheet, entry } = parseSheetName(given);
    const status = this.store.status(this.store.sheetUrl(sheet));
    if (status?.status !== 'ready') return null;
    const rect = status.picture.meta?.pictures?.[entry];
    return rect ? { src: status.picture.url, rect } : null;
  });

  protected readonly rect = computed(() => this.picture()?.rect ?? null);

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

  constructor() {
    // a named picture's sheet: loaded when the image is near the viewport, or at once when eager
    effect(() => {
      const given = this.hrsSprite();
      if (typeof given !== 'string' || (this.loading() === 'lazy' && !this.near())) return;
      const url = this.store.sheetUrl(parseSheetName(given).sheet);
      untracked(() => this.store.load(url));
    });
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.near.set(true);
            observer.disconnect();
          }
        },
        { rootMargin: LAZY_MARGIN },
      );
      observer.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
  }
}
