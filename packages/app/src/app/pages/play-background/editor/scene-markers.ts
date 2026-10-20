import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { Vec3 } from '../../../scenes/play-background/background-scene';
import type { SceneCamera } from '../../../scenes/play-background/play-scene';
import { cameraOutline, viewLine, viewPoint } from '../../../scenes/play-background/scene-camera';

/**
 * Something of a scene marked in the view where it is: a camera (what it sees outlined), a group
 * put in it, a light (on the side it comes from, a line to the body it lights). `key` is the row
 * it selects; `id` tells markers apart (a scene's light marks each planet it lights).
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
  /** A camera's own (what it sees outlined, as far ahead as `outline`). */
  readonly camera?: SceneCamera;
  readonly outline?: number;
  readonly selected: boolean;
  /** Whether it is switched off. */
  readonly off?: boolean;
}

/** How far ahead of a camera what it sees is outlined, where not given, in the scene's units. */
const OUTLINE = 12;
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
 * to its body, what a camera sees). One behind the view, or out of it, isn't shown.
 */
@Component({
  selector: 'hrs-scene-markers',
  imports: [MatIcon],
  templateUrl: './scene-markers.html',
  styleUrl: './scene-markers.scss',
})
export class SceneMarkers {
  readonly markers = input.required<readonly SceneMarker[]>();
  readonly camera = input.required<SceneCamera>();
  readonly aspect = input.required<number>();
  readonly picked = output<string>();

  protected readonly shown = computed(() => {
    const camera = this.camera();
    const aspect = this.aspect();
    const lines: Line[] = [];
    const points: (SceneMarker & { readonly x: number; readonly y: number })[] = [];
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
    for (const m of this.markers()) {
      const p = viewPoint(camera, aspect, m.at, m.camera ? NEAREST : undefined);
      // A camera where the view is (or behind it) isn't marked: its lines would fill the view.
      if (m.camera && !p) continue;
      if (m.from) line(m.from, m.at, m);
      if (m.camera)
        for (const [a, b] of cameraOutline(m.camera, aspect, m.outline ?? OUTLINE)) line(a, b, m);
      if (p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
        points.push({ ...m, x: p.x * 100, y: p.y * 100 });
    }
    return { lines, points };
  });
}
