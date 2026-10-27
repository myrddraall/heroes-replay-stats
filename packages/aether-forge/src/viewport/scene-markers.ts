import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import {
  cameraOutline,
  viewLine,
  viewPoint,
  viewRay,
} from '@myrddraall/heroes-replay-stats-aether/camera';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { SceneCamera } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { MarkerMode } from '../layout/editor-ui.store';

/**
 * Something of a scene marked in the view where it is: a camera (what it sees outlined), a group
 * put in it, a light (one from a side on that side, a line to the body it lights; one from all
 * round on the body's middle), a planet's pole (its name, N or S, at its axis's end, the planet
 * selected). `key` is the row it selects; `id` tells markers apart (a scene's light marks each
 * planet it lights).
 */
export interface SceneMarker {
  readonly id: string;
  readonly key: string;
  readonly kind: 'camera' | 'group' | 'light' | 'pole';
  readonly label: string;
  readonly icon: string;
  readonly at: Vec3;
  /** Where its line starts (a light's: at the body it lights). */
  readonly from?: Vec3;
  /** Its other lines, shown when it is selected (a spot's: the edges of its cone, to the body). */
  readonly lines?: readonly (readonly [Vec3, Vec3])[];
  /** A camera's own (what it sees outlined, as far ahead as `outline`). */
  readonly camera?: SceneCamera;
  readonly outline?: number;
  readonly selected: boolean;
  /** Whether it is switched off. */
  readonly off?: boolean;
  /** How many markers' widths it is moved across from where it is (several at one place, side by side). */
  readonly nudge?: number;
  /** A pole's: which end of which of its body's axes (see `axisAids`); dragged, it moves the axis. */
  readonly pole?: { readonly north: boolean; readonly axis: number };
}

/** A pole dragged in the view: begun, moved (the way from the eye through the pointer), ended. */
export interface PoleDrag {
  readonly phase: 'start' | 'move' | 'end';
  readonly north: boolean;
  readonly axis: number;
  /** The way from the camera's eye through the pointer, in the scene (unit). */
  readonly ray: Vec3;
}

/** How far ahead of a camera what it sees is outlined, where not given, in the scene's units. */
const OUTLINE = 12;
/** A marker's width and the gap after it, in pixels (what a nudge moves it by). */
const MARKER_WIDTH = 32;
/** How near a camera's own place may be to the view's and still be marked (nearer: it is where the view is). */
const NEAREST = 1;

/** A line of the markers, in shares of the view (as the SVG's 100 by 100 box has them). */
interface Line {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly selected: boolean;
  readonly off: boolean;
}

/**
 * The scene's markers over the view (presentational): each where it is as `camera` sees it, in a
 * view `aspect` wide, a button that picks it (`picked`: its row's key), with its lines (a light's
 * to its body and a spot's cone's edges, when it is selected; what a camera sees). One behind
 * the view, or out of it, isn't shown. A light's marker not selected is small (`lite`: a dot,
 * its icon on hover), not to get in the way of the light itself; in the `selected` mode only the
 * selected thing's markers show (a light's own; otherwise the lights of the body selected). A
 * planet's poles' names may be dragged (`poleDrag`: the way through the pointer as it goes).
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
  readonly picked = output<string>();
  readonly poleDrag = output<PoleDrag>();
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
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

  protected readonly shown = computed(() => {
    const camera = this.camera();
    const aspect = this.aspect();
    const lines: Line[] = [];
    const points: (SceneMarker & {
      readonly left: string;
      readonly y: number;
      readonly lite: boolean;
    })[] = [];
    const all = this.markers();
    const lightSelected = all.some((m) => m.kind === 'light' && m.selected);
    const markers =
      this.mode() === 'selected'
        ? all.filter((m) => m.selected || (m.kind === 'light' && !lightSelected))
        : all;
    const line = (a: Vec3, b: Vec3, m: SceneMarker) => {
      const l = viewLine(camera, aspect, a, b);
      if (l)
        lines.push({
          x1: l[0].x * 100,
          y1: l[0].y * 100,
          x2: l[1].x * 100,
          y2: l[1].y * 100,
          selected: m.selected,
          off: !!m.off,
        });
    };
    for (const m of markers) {
      const p = viewPoint(camera, aspect, m.at, m.camera ? NEAREST : undefined);
      // A camera where the view is (or behind it) isn't marked: its lines would fill the view.
      if (m.camera && !p) continue;
      const lite = m.kind === 'light' && !m.selected;
      if (m.from && !lite) line(m.from, m.at, m);
      if (m.selected) for (const [a, b] of m.lines ?? []) line(a, b, m);
      if (m.camera)
        for (const [a, b] of cameraOutline(m.camera, aspect, m.outline ?? OUTLINE)) line(a, b, m);
      if (p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
        points.push({
          ...m,
          left: `calc(${p.x * 100}% + ${(m.nudge ?? 0) * MARKER_WIDTH}px)`,
          y: p.y * 100,
          lite,
        });
    }
    return { lines, points };
  });
}
