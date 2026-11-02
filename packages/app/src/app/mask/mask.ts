import { computed, Directive, ElementRef, inject, input } from '@angular/core';

/** The built-in masks, by name. */
export type MaskPreset =
  | 'fade-top'
  | 'fade-bottom'
  | 'fade-left'
  | 'fade-right'
  | 'fade-x'
  | 'fade-y'
  | 'fade-edges'
  | 'vignette'
  | 'circle'
  | 'spotlight';

/**
 * What to mask with: a preset name, an image path (`assets/star.svg`), any CSS mask value
 * (`linear-gradient(…)`), or an SVG `<mask>` element from a template ref (which templates type as
 * `HTMLElement`, hence `Element`).
 */
export type MaskSource = MaskPreset | Element | (string & {});

const pct = (n: number) => `${n * 100}%`;
const fadeX = (f: number) =>
  `linear-gradient(to right, transparent, #000 ${pct(f)} ${pct(1 - f)}, transparent)`;
const fadeY = (f: number) =>
  `linear-gradient(transparent, #000 ${pct(f)} ${pct(1 - f)}, transparent)`;

const PRESETS: Record<MaskPreset, (fade: number, radius: string) => string> = {
  'fade-top': (f) => `linear-gradient(to bottom, transparent, #000 ${pct(f)})`,
  'fade-bottom': (f) => `linear-gradient(to top, transparent, #000 ${pct(f)})`,
  'fade-left': (f) => `linear-gradient(to right, transparent, #000 ${pct(f)})`,
  'fade-right': (f) => `linear-gradient(to left, transparent, #000 ${pct(f)})`,
  'fade-x': fadeX,
  'fade-y': fadeY,
  'fade-edges': (f) => `${fadeX(f)} intersect, ${fadeY(f)}`,
  vignette: (f) => `radial-gradient(closest-side, #000 ${pct(1 - f)}, transparent)`,
  circle: () => 'radial-gradient(circle closest-side, #000 calc(100% - 1px), transparent)',
  spotlight: (f, r) =>
    `radial-gradient(circle ${r} at var(--mask-x, 50%) var(--mask-y, 50%), #000 ${pct(1 - f)}, transparent)`,
};

let nextMaskId = 0;

/** Gives an SVG `<mask>` an id if it has none, so `url(#id)` can name it. Calling it again changes nothing. */
function maskId(el: Element): string {
  el.id ||= `hrs-mask-${nextMaskId++}`;
  return el.id;
}

/**
 * Masks an element and everything in it, whatever it holds (an image, text, a video, a component):
 * `<img hrsMask="fade-bottom">`. `hrsMask` takes a preset, an image path
 * (`hrsMask="assets/hex.svg"`, fitted by `maskFit`), any CSS mask value, or an SVG `<mask>` from a
 * template ref (`[hrsMask]="shape"`). `maskFade` sets how much a fade covers; the `spotlight` preset
 * follows the pointer, `maskRadius` wide.
 */
@Directive({
  selector: '[hrsMask]',
  host: {
    '[style.mask]': 'mask()',
    '(pointermove)': 'follow($event)',
    '(pointerleave)': 'centre()',
  },
})
export class Mask {
  readonly hrsMask = input.required<MaskSource>();
  /** How much of the element a fade covers, 0 to 1; also softens the vignette's and spotlight's edges. */
  readonly maskFade = input(0.25);
  /** How an image mask fits the element. */
  readonly maskFit = input<'contain' | 'cover' | 'fill'>('contain');
  /** The spotlight's size. */
  readonly maskRadius = input('6rem');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** The CSS `mask` value the element gets. */
  readonly mask = computed(() => {
    const source = this.hrsMask();
    if (typeof source !== 'string') return `url(#${maskId(source)})`;
    if (Object.hasOwn(PRESETS, source)) {
      return PRESETS[source as MaskPreset](this.maskFade(), this.maskRadius());
    }
    if (source.includes('(')) return source;
    const size = this.maskFit() === 'fill' ? '100% 100%' : this.maskFit();
    return `url("${source}") center / ${size} no-repeat`;
  });

  // Written straight onto the element: a signal per pointer move would run change detection for nothing.
  protected follow(e: PointerEvent): void {
    if (this.hrsMask() !== 'spotlight') return;
    const r = this.el.getBoundingClientRect();
    this.el.style.setProperty('--mask-x', `${e.clientX - r.left}px`);
    this.el.style.setProperty('--mask-y', `${e.clientY - r.top}px`);
  }

  protected centre(): void {
    this.el.style.removeProperty('--mask-x');
    this.el.style.removeProperty('--mask-y');
  }
}
