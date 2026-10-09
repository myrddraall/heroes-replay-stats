import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MapElementsLayer } from '../layers/elements/map-elements-layer';
import type { ElementShown } from '../layers/elements/element-pieces';
import { MapFixedLayer } from '../layers/map-fixed-layer';
import { MapTileLayer } from '../layers/map-tile-layer';
import { MapTileLoader } from '../layers/map-tile-loader';
import { MapMinimapLayer } from '../layers/minimap/map-minimap-layer';
import type { MapViewModel } from '../pack/map-assets';
import type { ViewPoint } from '../view/camera';
import { MapRenderer } from './map-renderer';
import { MapViewerStore } from './map-viewer.store';

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
 */
@Component({
  selector: 'hrs-map-viewer',
  imports: [MapFixedLayer, MapTileLayer, MapElementsLayer, MapMinimapLayer],
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

  /** A structure or camp was clicked: its key. */
  readonly elementClick = output<string>();
  /** The minimap's loading screen has faded away. */
  readonly minimapFaded = output<void>();

  protected readonly store = inject(MapViewerStore);
  protected readonly renderer = inject(MapRenderer);
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

  private point(e: MouseEvent): ViewPoint {
    const box = this.host.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  protected pointerDown(e: PointerEvent): void {
    this.last = this.down = this.point(e);
    this.host.setPointerCapture(e.pointerId);
    this.dragging.set(true);
  }

  protected pointerMove(e: PointerEvent): void {
    const point = this.point(e);
    if (!this.last) {
      this.renderer.hover(point);
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
    if (down && Math.hypot(point.x - down.x, point.y - down.y) < CLICK_SLOP)
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
    const middle = { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2 };
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
