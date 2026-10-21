import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { Vec3 } from '../../../scenes/play-background/background-scene';
import type { SceneCamera } from '../../../scenes/play-background/play-scene';
import { cameraOutline, viewLine, viewPoint } from '../../../scenes/play-background/scene-camera';
import type { MarkerMode } from './editor-ui.store';

/**
 * Something of a scene marked in the view where it is: a camera (what it sees outlined), a group
 * put in it, a light (one from a side on that side, a line to the body it lights; one from all
 * round on the body's middle). `key` is the row it selects; `id` tells markers apart (a scene's
 * light marks each planet it lights).
 */
export interface SceneMarker {
  readonly id: string;
  readonly key: string;
  readonly kind: 'camera' | 'group' | 'light';
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
 * selected thing's markers show (a light's own; otherwise the lights of the body selected).
 */
@Component({
  selector: 'hrs-scene-markers',
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
