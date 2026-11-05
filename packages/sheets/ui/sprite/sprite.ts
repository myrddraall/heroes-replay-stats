import {
  booleanAttribute,
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
import { parseSheetName, SHEET_PICTURES, type SpritePicture } from '../../model';

const px = (n: number) => `${n}px`;

/** How far ahead of the viewport a lazy sheet starts loading, as `loading="lazy"` images do. */
const LAZY_MARGIN = '300px';

/**
 * Shows a picture on an `<img>`, staying an `<img>` (alt text, lazy loading, error events): a
 * file as it is, or one picture of a sheet cut out of it. `<img [hrsSprite]="icon" [spriteWidth]="32"
 * alt="">`, or a picture a sheet names in its own metadata, `<img hrsSprite="validation#settings">`
 * (the sheet loaded once for every picture in it, through `SHEET_PICTURES`; with `loading="lazy"`,
 * only once the image nears the viewport). The `<img>` is sized to the picture in the sheet and
 * shows that part of it (`object-fit: none`, `object-position`), then `zoom` scales it to
 * `spriteWidth` pixels wide or `spriteHeight` pixels high (the other side follows). Without either,
 * a sheet's picture shows at its own size and a file is sized by the page's CSS. `zoom`, unlike
 * `transform: scale`, scales the space it takes too. With `spriteCover`, it covers its parent's
 * box instead, as `object-fit: cover` does: scaled to fill it, centred, the rest cut off by the
 * parent (which hides its overflow); a file fills it with `object-fit: cover`.
 */
@Directive({
  selector: 'img[hrsSprite]',
  host: {
    '[attr.src]': 'picture()?.src ?? null',
    '[attr.loading]': 'loading()',
    decoding: 'async',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.object-fit]': 'rect() ? "none" : cover() ? "cover" : null',
    '[style.object-position]': 'position()',
    '[style.zoom]': 'zoom()',
    '[style.display]': 'cover() ? "block" : null',
    '[style.margin-left]': 'coverOffset()?.[0] ?? null',
    '[style.margin-top]': 'coverOffset()?.[1] ?? null',
  },
})
export class Sprite {
  /** The picture: as an object, or a sheet's picture by name (`sheet#picture`). */
  readonly hrsSprite = input.required<SpritePicture | string>();
  /** The width to show it at, in CSS pixels; its own width (a sheet's picture) or the CSS's (a file) when not set. */
  readonly spriteWidth = input<number>();
  /** The height to show it at instead, in CSS pixels (pictures of one height but varied widths, such as emotes). */
  readonly spriteHeight = input<number>();
  /** Cover the parent's box (scaled to fill it, centred) instead of a set width or height. */
  readonly spriteCover = input(false, { transform: booleanAttribute });
  /** `lazy` unless the picture is needed at once. */
  readonly loading = input<'lazy' | 'eager'>('lazy');

  private readonly store = inject(SHEET_PICTURES);
  private readonly element = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  /** The parent's size, for `spriteCover`. */
  private readonly box = signal<readonly [number, number] | null>(null);
  protected readonly cover = computed(() => this.spriteCover());
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

  /** The scale that makes a sheet's picture cover the parent's box. */
  private readonly coverScale = computed(() => {
    const rect = this.rect();
    const box = this.box();
    if (!this.cover() || !rect || !box) return null;
    return Math.max(box[0] / rect[2], box[1] / rect[3]);
  });

  /** How far it sits from the parent's corner, centred (in its own, zoomed, pixels). */
  protected readonly coverOffset = computed(() => {
    const scale = this.coverScale();
    const rect = this.rect();
    const box = this.box();
    if (scale === null || !rect || !box) return null;
    return [
      px((box[0] - rect[2] * scale) / 2 / scale),
      px((box[1] - rect[3] * scale) / 2 / scale),
    ] as const;
  });

  protected readonly width = computed(() => {
    const rect = this.rect();
    if (rect) return px(rect[2]);
    if (this.cover()) return '100%';
    const width = this.spriteWidth();
    return width === undefined ? null : px(width);
  });

  protected readonly height = computed(() => {
    const rect = this.rect();
    if (rect) return px(rect[3]);
    if (this.cover()) return '100%';
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
    const cover = this.coverScale();
    if (cover !== null) return String(cover);
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
    // the parent's box, for spriteCover
    effect((onCleanup) => {
      const parent = this.element.parentElement;
      if (!this.cover() || !parent || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() =>
        this.box.set([parent.clientWidth, parent.clientHeight]),
      );
      observer.observe(parent);
      onCleanup(() => observer.disconnect());
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
      observer.observe(this.element);
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
  }
}
