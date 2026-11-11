import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * A picture a portrait may show: the picture (with its smaller copies, `variants`, where it has
 * them) and its size over the frame's inside (`scale`: larger than 1 where its art is only part of
 * it, a minimap icon's hero 26 of its 32).
 */
export interface PortraitSource {
  readonly picture: SpritePicture;
  readonly scale?: number;
}

/**
 * The source to show of `sources` (in order of preference) drawn `drawn` device pixels across: the
 * first whose biggest copy covers that, else the biggest; until measured (`null`), the first.
 */
export function portraitSource(
  sources: readonly PortraitSource[],
  drawn: number | null,
): PortraitSource | null {
  if (sources.length < 2 || drawn === null) return sources[0] ?? null;
  const across = (s: PortraitSource) => (s.picture.rect?.[2] ?? Infinity) / (s.scale ?? 1);
  return (
    sources.find((s) => across(s) >= drawn) ??
    sources.reduce((a, b) => (across(b) > across(a) ? b : a))
  );
}

/**
 * A portrait (presentational), to put in a shaped frame (`hrs-circle-frame`, `hrs-hex-frame`,
 * `hrs-square-frame`): it fills the frame's inside, which cuts it to its shape. Named for what it
 * shows (`name`, its alt text); nothing without a source.
 *
 * Its `sources` are what it may show, in order of preference: it shows the first big enough for
 * the size it is drawn at (its art, at least as many device pixels across as the inside), else the
 * biggest; the picture then shows its smallest copy that is big enough. So a hero in a small circle
 * shows the game's minimap icon (art made for that size) and the same hero bigger, or in a square,
 * its square art (`[minimap icon, square art]`), each from the smallest sheet that serves.
 */
@Component({
  selector: 'hrs-portrait',
  imports: [Sprite],
  template: `@if (shown(); as source) {
    <span class="art" [style.width.%]="(source.scale ?? 1) * 100">
      <img [hrsSprite]="source.picture" spriteCover [alt]="name()" />
    </span>
  }`,
  styles: `
    /* the frame's inside exactly (not grown to the picture), so the picture centres on it */
    :host {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template: 100% / 100%;
    }
    .art {
      place-self: unsafe center;
      aspect-ratio: 1;
      overflow: hidden;
    }
  `,
})
export class Portrait {
  readonly sources = input<readonly PortraitSource[]>([]);
  readonly name = input.required<string>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** How wide it is drawn, in device pixels (none yet: not measured). */
  private readonly drawn = signal<number | null>(null);

  /** The source to show: the first whose biggest copy covers it as drawn, else the biggest. */
  protected readonly shown = computed(() => portraitSource(this.sources(), this.drawn()));

  constructor() {
    effect((onCleanup) => {
      if (this.sources().length < 2 || typeof ResizeObserver === 'undefined') return;
      const ratio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
      const observer = new ResizeObserver(() => this.drawn.set(this.element.clientWidth * ratio));
      observer.observe(this.element);
      onCleanup(() => observer.disconnect());
    });
  }
}
