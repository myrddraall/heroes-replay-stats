import {
  afterNextRender,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MapElementsLayer } from '../layers/elements/map-elements-layer';
import type { ElementShown } from '../layers/elements/element-pieces';
import { MapFixedLayer } from '../layers/map-fixed-layer';
import { MapTileLayer } from '../layers/map-tile-layer';
import { MapTileLoader } from '../layers/map-tile-loader';
import { MapMinimapLayer } from '../layers/minimap/map-minimap-layer';
import type { MapViewModel } from '../pack/map-assets';
import type { ViewPoint } from '../view/camera';
import { NgTemplateOutlet } from '@angular/common';
import { MapRenderer } from './map-renderer';
import { type BarSide, MapViewerBar } from './map-viewer-bar';
import { MapViewerStore, type MapViewerBars } from './map-viewer.store';

/** A press that moved less than this (in pixels) is a click, not a drag. */
const CLICK_SLOP = 4;
/** How much a notch of the mouse wheel zooms. */
const WHEEL_ZOOM = 0.0015;
/** How far an arrow key pans, in pixels, and how much `+` and `-` zoom. */
const KEY_PAN = 80;
const KEY_ZOOM = 1.25;

/**
 * The map viewer (presentational): draws the map it is given, and its own layers from the pack's
 * data (their order and parallax), and any other layer directive placed inside it. It keeps only
 * its UI state, the camera (drag to pan, wheel to zoom about the pointer, the keyboard too) and
 * the hover; what happens on a click is its container's to decide.
 *
 * Zoomed out all the way it shows the whole playable area, and it never shows the sky's edge;
 * where it is too wide or too tall for both, the map is drawn in a narrower view, centred, between
 * bars: two elements beside the view, black, or styled with `--hrs-map-viewer-bars`, or filled
 * with an `ng-template[hrsMapViewerBar]` placed inside the viewer. They are part of the map: they
 * fade in with it. With `bars="shrink"` they recede as the camera zooms in, where the sky fills
 * more; the map stays put. The viewer has no background of its own: the page shows through until
 * the map is drawn.
 */
@Component({
  selector: 'hrs-map-viewer',
  imports: [NgTemplateOutlet, MapFixedLayer, MapTileLayer, MapElementsLayer, MapMinimapLayer],
  templateUrl: './map-viewer.html',
  styleUrl: './map-viewer.scss',
  providers: [MapViewerStore, MapRenderer, MapTileLoader],
  host: {
    role: 'application',
    'aria-roledescription': 'map',
    '[attr.aria-label]': 'label()',
    tabindex: '0',
    '[class.map-viewer--dragging]': 'dragging()',
    '[class.map-viewer--over-element]': 'renderer.overInteractive()',
    '[class.map-viewer--settled]': 'renderer.settled()',
    '(pointerdown)': 'pointerDown($event)',
    '(pointermove)': 'pointerMove($event)',
    '(pointerup)': 'pointerUp($event)',
    '(pointercancel)': 'endDrag()',
    '(pointerleave)': 'renderer.hover(null)',
    '(wheel)': 'wheel($event)',
    '(keydown)': 'key($event)',
  },
})
export class MapViewer {
  /** The map to show: its pack and where its files come from. */
  readonly map = input<MapViewModel | null>(null);
  /** The map is being loaded. */
  readonly loading = input(false);
  /** Why the map couldn't be loaded. */
  readonly error = input<string | null>(null);
  /** The arena shown, on a map of several. */
  readonly arena = input(0);
  /** The pack's layers to leave out, by id (`fixed`, `background`, `haze`, `map`, `elements`, `minimap`). */
  readonly hiddenLayers = input<readonly string[]>([]);
  /** What each structure and camp shows, by its key (`structure-<id>`, `camp-<camp>`); off if not given. */
  readonly elementStates = input<Readonly<Record<string, ElementShown>>>({});
  /** The bars, where the viewer is too wide or too tall for the sky: fixed, or receding as it zooms in. */
  readonly bars = input<MapViewerBars>('fixed');

  /** A structure or camp was clicked: its key. */
  readonly elementClick = output<string>();
  /** The minimap's loading screen has faded away. */
  readonly minimapFaded = output<void>();

  protected readonly store = inject(MapViewerStore);
  protected readonly renderer = inject(MapRenderer);

  /** The template the bars are filled with, when one is placed in the viewer. */
  protected readonly barTemplate = contentChild(MapViewerBar);

  /** The bars: the viewer's strips beside the view, left and right or top and bottom; none when the view is all of it. */
  protected readonly barBoxes = computed(
    (): { side: BarSide; x: number; y: number; w: number; h: number }[] => {
      const { width, height } = this.store.host();
      const { x, y, w, h } = this.store.frame();
      if (x > 0) {
        return [
          { side: 'left', x: 0, y: 0, w: x, h: height },
          { side: 'right', x: x + w, y: 0, w: width - x - w, h: height },
        ];
      }
      if (y > 0) {
        return [
          { side: 'top', x: 0, y: 0, w: width, h: y },
          { side: 'bottom', x: 0, y: y + h, w: width, h: height - y - h },
        ];
      }
      return [];
    },
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly dragging = signal(false);
  protected readonly hidden = computed(() => new Set(this.hiddenLayers()));
  protected readonly label = computed(
    () =>
      `${this.map()?.pack.map.name ?? 'Map'}: drag or use the arrow keys to pan, mouse wheel or + and - to zoom`,
  );
  private last: ViewPoint | null = null;
  private down: ViewPoint | null = null;

  constructor() {
    effect(() => this.store.setMap(this.map()));
    effect(() => this.store.showArena(this.arena()));
    effect(() => {
      // Only the input: setting it moves the camera, which this effect must not track.
      const bars = this.bars();
      untracked(() => this.store.setBars(bars));
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const resize = () =>
        this.store.resize({
          width: this.host.clientWidth,
          height: this.host.clientHeight,
          dpr: globalThis.devicePixelRatio || 1,
        });
      const observer = new ResizeObserver(resize);
      observer.observe(this.host);
      // the device pixel ratio changes without the size changing (a window moved to another screen)
      globalThis.addEventListener('resize', resize);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        globalThis.removeEventListener('resize', resize);
      });
      resize();
    });
  }

  /** Where an event is in the view (it may be over the bars, outside it). */
  private point(e: MouseEvent): ViewPoint {
    const box = this.host.getBoundingClientRect();
    const frame = this.store.frame();
    return { x: e.clientX - box.left - frame.x, y: e.clientY - box.top - frame.y };
  }

  private inView({ x, y }: ViewPoint): boolean {
    const frame = this.store.frame();
    return x >= 0 && y >= 0 && x < frame.w && y < frame.h;
  }

  protected pointerDown(e: PointerEvent): void {
    this.last = this.down = this.point(e);
    this.host.setPointerCapture(e.pointerId);
    this.dragging.set(true);
  }

  protected pointerMove(e: PointerEvent): void {
    const point = this.point(e);
    if (!this.last) {
      this.renderer.hover(this.inView(point) ? point : null);
      return;
    }
    this.store.panBy(point.x - this.last.x, point.y - this.last.y);
    this.last = point;
  }

  protected pointerUp(e: PointerEvent): void {
    const point = this.point(e);
    const down = this.down;
    this.down = null;
    this.endDrag();
    if (down && this.inView(point) && Math.hypot(point.x - down.x, point.y - down.y) < CLICK_SLOP)
      this.renderer.click(point);
  }

  protected endDrag(): void {
    this.last = null;
    this.dragging.set(false);
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    this.store.zoomAt(this.point(e), Math.exp(-e.deltaY * WHEEL_ZOOM));
  }

  protected key(e: KeyboardEvent): void {
    const frame = this.store.frame();
    const middle = { x: frame.w / 2, y: frame.h / 2 };
    const pans: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const pan = pans[e.key];
    if (pan) this.store.panBy(...pan);
    else if (e.key === '+' || e.key === '=') this.store.zoomAt(middle, KEY_ZOOM);
    else if (e.key === '-') this.store.zoomAt(middle, 1 / KEY_ZOOM);
    else if (e.key === 'Home') this.store.recentre();
    else return;
    e.preventDefault();
  }
}
