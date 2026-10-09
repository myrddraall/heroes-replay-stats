import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import {
  LAYER_DONE,
  type LayerFrame,
  type MapLayer,
  type MapLayerStatus,
} from '../../viewer/map-layer';
import { MapLayerPlacement } from '../../viewer/map-layer-placement';
import { MapRenderer } from '../../viewer/map-renderer';
import { MapViewerStore } from '../../viewer/map-viewer.store';

/**
 * Where the minimap is in its life: the loading screen, fading away once the first view is
 * drawn, gone (faded, or turned off), or shown by choice.
 */
type MinimapPhase = 'intro' | 'fading' | 'gone' | 'shown';

/**
 * The pack's custom minimap as SVG, lying over the map cells it covers (PACK.md, Images), placed
 * through the projection of its rate. It is put in the page itself (as an `<img>` its strokes
 * would grow with it; in the page they keep their width on screen at any zoom). It starts as the
 * loading screen: once the viewer's first view is drawn it fades away and says so (`faded`).
 */
@Component({
  selector: 'hrs-map-minimap-layer',
  template: '',
  styleUrl: './map-minimap-layer.scss',
  // The SVG's own elements are styled, and they come from the pack, not from a template.
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: MapLayerPlacement, inputs: ['order', 'rate'] }],
  host: {
    'aria-hidden': 'true',
    '[hidden]': '!visible() || !loaded()',
    '[class.map-minimap-layer--faded]': "phase() === 'fading' || phase() === 'gone'",
    '[class.map-minimap-layer--over-terrain]': "overTerrain() && phase() === 'shown'",
    '(transitionend)': 'transitionEnd()',
  },
})
export class MapMinimapLayer implements MapLayer {
  readonly visible = input(true);
  /** The terrain is shown under it: it lets it show through. */
  readonly overTerrain = input(false);
  /** The loading screen has faded away. */
  readonly faded = output<void>();

  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly store = inject(MapViewerStore);
  private readonly renderer = inject(MapRenderer);
  private readonly place = inject(MapLayerPlacement);

  private readonly svg = computed(() => {
    const map = this.store.map();
    const svg = map?.pack.images.customMinimapSvg;
    return map && svg ? { assets: map.assets, file: svg.file, bounds: svg.boundsCells } : null;
  });
  protected readonly loaded = signal(false);
  protected readonly phase = signal<MinimapPhase>('intro');

  constructor() {
    effect((onCleanup) => {
      const svg = this.svg();
      this.loaded.set(false);
      this.phase.set('intro');
      this.element.replaceChildren();
      if (!svg) return;
      const abort = new AbortController();
      onCleanup(() => abort.abort());
      svg.assets
        .text(svg.file, abort.signal)
        .then((text) => {
          const picture = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
          this.element.replaceChildren(document.importNode(picture, true));
          this.loaded.set(true);
          this.renderer.redraw();
        })
        .catch(() => undefined); // no minimap: the map loads without its loading screen
    });
    // Turned on or off once loaded: no longer the loading screen, and no fading away.
    let shown: boolean | null = null;
    effect(() => {
      const visible = this.visible();
      untracked(() => {
        if (shown !== null && visible !== shown && this.loaded()) {
          this.phase.set(visible ? 'shown' : 'gone');
        }
      });
      shown = visible;
    });
    // The first view drawn: the loading screen fades away.
    effect(() => {
      if (this.renderer.settled() && this.phase() === 'intro' && this.loaded() && this.visible()) {
        this.phase.set('fading');
      }
    });
    effect((onCleanup) => onCleanup(this.renderer.register(this)));
  }

  placement() {
    return this.place.placement();
  }

  protected transitionEnd(): void {
    if (this.phase() !== 'fading') return;
    this.phase.set('gone');
    this.faded.emit();
  }

  render(frame: LayerFrame): MapLayerStatus {
    const svg = this.svg();
    if (!svg || !this.loaded()) return LAYER_DONE;
    const { projection } = frame;
    const b = svg.bounds;
    const topLeft = projection.toScreen([b.left, b.top]);
    const bottomRight = projection.toScreen([b.right, b.bottom]);
    const style = this.element.style;
    style.left = `${topLeft.x}px`;
    style.top = `${topLeft.y}px`;
    style.width = `${bottomRight.x - topLeft.x}px`;
    style.height = `${bottomRight.y - topLeft.y}px`;
    const clip = frame.arena.minimapClip;
    if (clip) {
      const k = projection.cellScale;
      const inset = [
        b.top - clip.top,
        b.right - clip.right,
        clip.bottom - b.bottom,
        clip.left - b.left,
      ];
      style.clipPath = `inset(${inset.map((v) => `${Math.max(0, v * k)}px`).join(' ')})`;
    }
    return LAYER_DONE;
  }
}
