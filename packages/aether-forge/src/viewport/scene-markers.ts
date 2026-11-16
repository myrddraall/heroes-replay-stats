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
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { viewPoint, viewRay } from '@myrddraall/heroes-replay-stats-aether/camera';
import type { SceneCamera } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { MarkerMode } from '../layout/editor-ui.store';
import { MARKER_WIDTH, NEAREST, shownMarkers } from './marker-aids';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
import type { LightDrag, LightHandle } from './light-drag';

/**
 * Something of a scene marked in the view where it is: a camera (what it sees outlined), a group
 * put in it, a light (one from a side on that side, a line to the body it lights; one from all
 * round on the body's middle), a planet's pole (its name, N or S, at its axis's end, the planet
 * selected), a planet or moon (picked by its disk), a spot's aim (its second handle, the spot
 * selected). `key` is the row it selects; `id` tells markers apart (a scene's light marks each
 * planet it lights).
 */
export interface SceneMarker {
  readonly id: string;
  readonly key: string;
  readonly kind: 'camera' | 'group' | 'light' | 'pole' | 'body' | 'aim';
  readonly label: string;
  readonly icon: string;
  readonly at: Vec3;
  /** How far toward the eye from `at` its dot is (a body's: its radius, on its sphere's near side). */
  readonly lift?: number;
  /** Where its line starts (a light's: at the body it lights). */
  readonly from?: Vec3;
  /** Its other lines, shown when it is selected (a spot's: the edges of its cone, to the body; a point's or a spot's reach). */
  readonly lines?: readonly (readonly [Vec3, Vec3])[];
  /** Its settings' lines, solid but thinner, shown when it is selected (a point's reach in front of it: see `lightSettingLines`). */
  readonly thinLines?: readonly (readonly [Vec3, Vec3])[];
  /** Its settings' lines, dashed, shown when it is selected (a spot's fade edge, an environment's sky: see `lightSettingLines`). */
  readonly softLines?: readonly (readonly [Vec3, Vec3])[];
  /** A camera's own (what it sees outlined, as far ahead as `outline`). */
  readonly camera?: SceneCamera;
  readonly outline?: number;
  readonly selected: boolean;
  /** Whether it is switched off. */
  readonly off?: boolean;
  /** Whether the light selected leaves it out (an exception: it would light it otherwise), marked so. */
  readonly left?: boolean;
  /** How many markers' widths it is moved across from where it is (several at one place, side by side). */
  readonly nudge?: number;
  /** A pole's: which end of which of its body's axes (see `axisAids`); dragged, it moves the axis. */
  readonly pole?: { readonly north: boolean; readonly axis: number };
  /** A light's, or a spot's aim's: how it moves dragged (see `LightHandle`); none: it isn't. */
  readonly handle?: LightHandle;
}

/** A pole dragged in the view: begun, moved (the way from the eye through the pointer), ended. */
export interface PoleDrag {
  readonly phase: 'start' | 'move' | 'end';
  readonly north: boolean;
  readonly axis: number;
  /** The way from the camera's eye through the pointer, in the scene (unit). */
  readonly ray: Vec3;
}

/** How far the pointer moves on a light's marker before it is dragged, not clicked, in pixels. */
const DRAG_AFTER = 4;

/**
 * The scene's markers over the view (presentational): each where it is as `camera` sees it, in a
 * view `aspect` wide, a button that picks it (`picked`: its row's key), shown only where it is
 * hovered (`hovered`, as `hover` tells), selected or focused: its dot and its lines are drawn in
 * the scene (see `markerAids`), and the button over a dot is what the pointer finds it by. A
 * body's isn't picked by its button (the view picks it by its disk). One behind the view, or out
 * of it, isn't shown; in the `selected` mode only the selected thing's. A planet's poles' names
 * may be dragged (`poleDrag`: the way through the pointer as it goes), and a light's marker or a
 * spot's aim (`lightDrag`); a light's, only once the pointer has moved a little (a click picks it).
 */
@Component({
  selector: 'forge-scene-markers',
  imports: [MatIcon],
  templateUrl: './scene-markers.html',
  styleUrl: './scene-markers.scss',
})
export class SceneMarkers {
  readonly markers = input.required<readonly SceneMarker[]>();
  readonly mode = input<MarkerMode>('all');
  readonly camera = input.required<SceneCamera>();
  readonly aspect = input.required<number>();
  /** What the pointer is over (a marker's button, or a body's disk), by its row's key. */
  readonly hovered = input<string | null>(null);
  readonly picked = output<string>();
  /** The pointer, or the focus, came onto a marker's button (its key) or left it (none). */
  readonly hover = output<string | null>();
  readonly poleDrag = output<PoleDrag>();
  readonly lightDrag = output<LightDrag>();
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  /** The marker the pointer (or the focus) is on, as told: let go of where it is no longer shown. */
  private readonly over = signal<string | null>(null);

  constructor() {
    effect(() => {
      const key = this.over();
      if (key && !this.shown().some((m) => m.key === key)) this.hoverOn(null);
    });
  }

  protected hoverOn(key: string | null): void {
    if (untracked(this.over) === key) return;
    this.over.set(key);
    this.hover.emit(key);
  }
  /** The pole being dragged, by its pointer. */
  private dragging?: { readonly id: number; readonly north: boolean; readonly axis: number };

  /** The way from the eye through a point of the page, as the view shows it. */
  private rayAt(event: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    return viewRay(
      this.camera(),
      this.aspect(),
      (event.clientX - r.left) / (r.width || 1),
      (event.clientY - r.top) / (r.height || 1),
    );
  }

  protected poleDown(event: PointerEvent, m: SceneMarker): void {
    if (!m.pole || event.button !== 0) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging = { id: event.pointerId, ...m.pole };
    this.poleDrag.emit({ phase: 'start', ...m.pole, ray: this.rayAt(event) });
  }

  protected poleMove(event: PointerEvent): void {
    const d = this.dragging;
    if (d && event.pointerId === d.id)
      this.poleDrag.emit({ phase: 'move', north: d.north, axis: d.axis, ray: this.rayAt(event) });
  }

  protected poleUp(event: PointerEvent): void {
    const d = this.dragging;
    if (!d || event.pointerId !== d.id) return;
    this.dragging = undefined;
    this.poleDrag.emit({ phase: 'end', north: d.north, axis: d.axis, ray: this.rayAt(event) });
  }

  /** The light marker pressed, by its pointer: where it was pressed, and whether it is being dragged. */
  private pressed?: {
    readonly id: number;
    readonly marker: string;
    readonly key: string;
    readonly x: number;
    readonly y: number;
    /** Whether a click follows it (a light's marker's, not an aim's handle's). */
    readonly clicks: boolean;
    moved: boolean;
  };
  /** Whether the click that ends a drag is to be let go (it picked the light as the drag began). */
  private dragged = false;

  protected lightDown(event: PointerEvent, m: SceneMarker): void {
    if (!m.handle || event.button !== 0) return;
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // (A pointer that can't be captured: dragged as far as it stays over the marker.)
    }
    this.pressed = {
      id: event.pointerId,
      marker: m.id,
      key: m.key,
      x: event.clientX,
      y: event.clientY,
      clicks: m.kind === 'light',
      moved: false,
    };
  }

  protected lightMove(event: PointerEvent): void {
    const p = this.pressed;
    if (!p || event.pointerId !== p.id) return;
    const ray = this.rayAt(event);
    if (!p.moved) {
      if (Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_AFTER) return;
      p.moved = true;
      this.lightDrag.emit({ phase: 'start', id: p.marker, key: p.key, ray });
    }
    this.lightDrag.emit({ phase: 'move', id: p.marker, key: p.key, ray });
  }

  protected lightUp(event: PointerEvent): void {
    const p = this.pressed;
    if (!p || event.pointerId !== p.id) return;
    this.pressed = undefined;
    if (!p.moved) return;
    this.dragged = p.clicks;
    this.lightDrag.emit({ phase: 'end', id: p.marker, key: p.key, ray: this.rayAt(event) });
  }

  protected pick(m: SceneMarker): void {
    if (this.dragged) this.dragged = false;
    else this.picked.emit(m.key);
  }

  protected readonly shown = computed(() => {
    const camera = this.camera();
    const aspect = this.aspect();
    const hovered = this.hovered();
    const points: (SceneMarker & {
      readonly x: number;
      readonly y: number;
      /** How far it is moved across, in pixels (several at one place, side by side). */
      readonly shift: number;
      /** Whether its button shows (hovered or selected; focused shows it too). */
      readonly open: boolean;
    })[] = [];
    for (const m of shownMarkers(this.markers(), this.mode())) {
      const p = viewPoint(camera, aspect, m.at, m.camera ? NEAREST : undefined);
      if (p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
        points.push({
          ...m,
          x: p.x * 100,
          y: p.y * 100,
          shift: (m.nudge ?? 0) * MARKER_WIDTH,
          open: m.selected || m.key === hovered,
        });
    }
    return points;
  });
}
