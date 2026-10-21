import { Component, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** A direction in a planet's frame: x to the right, y away from the eye, z up. */
export type Direction = readonly [number, number, number];

/** The sides the disc shows the planet from: the eye's (front), the opposite, or across or over it. */
export type DiscView = 'front' | 'behind' | 'left' | 'right' | 'top' | 'bottom';

/**
 * A view's frame on the disc: across it to the right, up it, and out of it towards the viewer,
 * each in the planet's frame; and how it is shown (its glyph, its name).
 */
interface ViewFrame {
  readonly right: Direction;
  readonly up: Direction;
  readonly out: Direction;
  readonly glyph: string;
  readonly label: string;
}

/**
 * The six views (the front's is the planet's face as the eye sees it, the others as a viewer
 * there would: looking from the left, right is away from the eye; from above, up is away).
 */
export const VIEWS: Readonly<Record<DiscView, ViewFrame>> = {
  front: { right: [1, 0, 0], up: [0, 0, 1], out: [0, -1, 0], glyph: '●', label: 'Front' },
  behind: { right: [-1, 0, 0], up: [0, 0, 1], out: [0, 1, 0], glyph: '○', label: 'Behind' },
  left: { right: [0, -1, 0], up: [0, 0, 1], out: [-1, 0, 0], glyph: '◀', label: 'Left' },
  right: { right: [0, 1, 0], up: [0, 0, 1], out: [1, 0, 0], glyph: '▶', label: 'Right' },
  top: { right: [1, 0, 0], up: [0, 1, 0], out: [0, 0, 1], glyph: '▲', label: 'Top' },
  bottom: { right: [-1, 0, 0], up: [0, 1, 0], out: [0, 0, -1], glyph: '▼', label: 'Bottom' },
};

/** Each way along the planet's axes, in a word. */
const WORDS: readonly (readonly [Direction, string])[] = [
  [[1, 0, 0], 'right'],
  [[-1, 0, 0], 'left'],
  [[0, 1, 0], 'away'],
  [[0, -1, 0], 'towards'],
  [[0, 0, 1], 'up'],
  [[0, 0, -1], 'down'],
];

let next = 0;
/** How far an arrow key moves the point, as a share of the disc's radius. */
const KEY_STEP = 0.05;
/**
 * How far in front of or behind the rim the point always stays: on the rim itself it would be on
 * neither side, and the side it is on would switch by itself (dragged to the edge, or flipped there).
 */
const MIN_DEPTH = 0.02;
const MAX_REACH = Math.sqrt(1 - MIN_DEPTH * MIN_DEPTH);
/** How many cuts the disc is divided by when snapping (like a pizza), and how near its middle snaps to it. */
export const SNAP_CUTS = 8;
const SNAP_MIDDLE = 0.12;
/**
 * How fast the point closes on the cursor in the fine drag, as a share of what is left each
 * second (further away: faster, in the disc's units).
 */
const FINE_RATE = 2.5;

const dot = (a: Direction, b: Direction) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Where a direction is on the disc seen from a view: across (right) and down, as shares of its radius; and whether it points away from the viewer. */
export function pointOf(
  view: DiscView,
  d: Direction,
): { readonly x: number; readonly y: number; readonly far: boolean } {
  const v = VIEWS[view];
  return { x: dot(d, v.right), y: -dot(d, v.up), far: dot(d, v.out) < 0 };
}

/**
 * The direction for a point on the disc seen from a view (`x` across, `down` down, as shares of
 * its radius), on the viewer's side or the far side (never on the rim, between them).
 */
export function directionAt(view: DiscView, x: number, down: number, far: boolean): Direction {
  const v = VIEWS[view];
  let px = x;
  let py = -down;
  const r = Math.hypot(px, py);
  if (r > MAX_REACH) {
    px *= MAX_REACH / r;
    py *= MAX_REACH / r;
  }
  const depth = Math.sqrt(Math.max(MIN_DEPTH * MIN_DEPTH, 1 - px * px - py * py)) * (far ? -1 : 1);
  return [0, 1, 2].map(
    (k) => px * v.right[k]! + py * v.up[k]! + depth * v.out[k]!,
  ) as unknown as Direction;
}

/**
 * A point on the disc snapped to the nearest of its cuts (SNAP_CUTS of them, round from the
 * top), as far along it, or to its middle when near it.
 */
export function snapped(x: number, down: number): { readonly x: number; readonly down: number } {
  const r = Math.hypot(x, down);
  if (r < SNAP_MIDDLE) return { x: 0, down: 0 };
  const step = (Math.PI * 2) / SNAP_CUTS;
  const angle = Math.round(Math.atan2(x, -down) / step) * step;
  return { x: Math.sin(angle) * r, down: -Math.cos(angle) * r };
}

/**
 * A direction on one short row of a properties panel (presentational), as a point on a disc that
 * is the planet seen from one of six sides (the eye's, the opposite, or across or over it;
 * chosen beside the disc): dragged (or moved with the arrow keys) to where the direction points
 * across that view; on the viewer's side or the far side of the planet (a hollow point), the same
 * for every direction. Dragged with Shift the point doesn't follow the cursor but closes on it,
 * faster the further away the cursor is (a fine drag); with Ctrl (or ⌘) it snaps to the disc's
 * cuts (eight, like a pizza) and to its middle.
 */
@Component({
  selector: 'hrs-property-direction',
  imports: [MatIcon],
  templateUrl: './property-direction.html',
  styleUrl: './property-direction.scss',
})
export class PropertyDirection {
  readonly label = input.required<string>();
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Where its value comes from where it isn't set here (a level under the one edited), if anywhere. */
  readonly origin = input<string>();
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  readonly value = input.required<Direction>();
  /**
   * Whether the sides are offered (the views, a far side): not where only the point across the
   * face counts (a reveal's, a rim's lean).
   */
  readonly sided = input(true);
  readonly valueChange = output<Direction>();
  protected readonly id = `property-direction-${next++}`;
  /** The side the disc shows the planet from. */
  protected readonly view = signal<DiscView>('front');
  protected readonly views = Object.entries(VIEWS) as readonly [DiscView, ViewFrame][];
  /** Whether a drag is snapping to the cuts (shown on the disc). */
  protected readonly snapping = signal(false);

  /** Where the point is on the disc, as shares of its radius from its centre (right, down). */
  protected readonly point = computed(() => pointOf(this.view(), this.unit()));
  /** Where the point is round the disc, in degrees clockwise from the top (for assistive technology). */
  protected readonly angle = computed(() => {
    const { x, y } = this.point();
    return Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360);
  });
  /** Whether it points away from the viewer (to the far side). */
  protected readonly far = computed(() => this.point().far);
  /** Where it points across the view, in words: how far each way (or the centre). */
  protected readonly offsets = computed(() => {
    const d = this.unit();
    const v = VIEWS[this.view()];
    const side = (axis: Direction) => {
      const along = dot(d, axis);
      if (Math.abs(along) < 0.15) return '';
      const way = along > 0 ? axis : ([-axis[0], -axis[1], -axis[2]] as const);
      const word = WORDS.find(([w]) => dot(w, way) > 0.5)?.[1] ?? '';
      return `${Math.round(Math.abs(along) * 100)}% ${word}`;
    };
    const parts = [side(v.right), side(v.up)].filter(Boolean);
    return parts.length ? parts : ['centre'];
  });
  /** Where it points, in words, the side too (for assistive technology; the point shows the side). */
  protected readonly text = computed(
    () =>
      `${this.offsets().join(', ')}, ${this.far() ? 'far side' : 'near side'}, seen from the ${VIEWS[this.view()].label.toLowerCase()}`,
  );

  /** The drag going on: the cursor's last place on the disc, its modifiers, and the fine drag's frame. */
  private drag?: {
    x: number;
    down: number;
    fine: boolean;
    snap: boolean;
    frame: number;
    at: number;
  };

  private unit(): Direction {
    const [x, y, z] = this.value();
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }

  /** The direction for a point on the disc, on the side it is on now. */
  private at(x: number, down: number, far = this.far()): Direction {
    return directionAt(this.view(), x, down, far);
  }

  protected pointerDown(event: PointerEvent): void {
    const disc = event.currentTarget as HTMLElement;
    // Not the browser's own press: that starts dragging any selected text off (cancelling this drag).
    event.preventDefault();
    disc.focus();
    try {
      disc.setPointerCapture(event.pointerId);
    } catch {
      // a pointer no longer down: the drag goes on while it moves over the disc
    }
    this.drag = { x: 0, down: 0, fine: false, snap: false, frame: 0, at: performance.now() };
    this.pointerMove(event);
  }

  protected pointerMove(event: PointerEvent): void {
    const disc = event.currentTarget as HTMLElement;
    const drag = this.drag;
    if (!drag) return;
    const box = disc.getBoundingClientRect();
    drag.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    drag.down = ((event.clientY - box.top) / box.height) * 2 - 1;
    this.modifiers(event);
    this.follow();
  }

  protected pointerUp(event: PointerEvent): void {
    const disc = event.currentTarget as HTMLElement;
    if (disc.hasPointerCapture(event.pointerId)) disc.releasePointerCapture(event.pointerId);
    this.endDrag();
  }

  /** The modifiers as a pointer or key event has them: Shift a fine drag, Ctrl (or ⌘) snapping. */
  private modifiers(event: PointerEvent | KeyboardEvent): void {
    const drag = this.drag;
    if (!drag) return;
    drag.fine = event.shiftKey;
    drag.snap = event.ctrlKey || event.metaKey;
    this.snapping.set(drag.snap);
  }

  /**
   * The point taken to the cursor (snapped where snapping): straight there, or, in a fine drag,
   * part of the way each frame, as long as the drag goes on.
   */
  private follow(): void {
    const drag = this.drag;
    if (!drag) return;
    const target = drag.snap ? snapped(drag.x, drag.down) : { x: drag.x, down: drag.down };
    cancelAnimationFrame(drag.frame);
    if (!drag.fine) {
      this.valueChange.emit(this.at(target.x, target.down));
      return;
    }
    const step = (now: number) => {
      const d = this.drag;
      if (!d) return;
      const dt = Math.min(0.1, (now - d.at) / 1000);
      d.at = now;
      const { x, y } = this.point();
      const k = Math.min(1, FINE_RATE * dt);
      const to = d.snap ? snapped(d.x, d.down) : { x: d.x, down: d.down };
      const nx = x + (to.x - x) * k;
      const ny = y + (to.down - y) * k;
      if (Math.hypot(to.x - nx, to.down - ny) > 0.002) this.valueChange.emit(this.at(nx, ny));
      d.frame = requestAnimationFrame(step);
    };
    drag.at = performance.now();
    drag.frame = requestAnimationFrame(step);
  }

  private endDrag(): void {
    if (this.drag) cancelAnimationFrame(this.drag.frame);
    this.drag = undefined;
    this.snapping.set(false);
  }

  protected key(event: KeyboardEvent): void {
    // A modifier pressed or let go during a drag changes how it follows.
    if (this.drag && (event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta')) {
      this.modifiers(event);
      this.follow();
      return;
    }
    const { x, y } = this.point();
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      this.valueChange.emit(this.at(x + move[0], y + move[1]));
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.valueChange.emit(this.at(0, 0));
    }
  }

  protected keyUp(event: KeyboardEvent): void {
    if (this.drag && (event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta')) {
      this.modifiers(event);
      this.follow();
    }
  }

  protected look(view: DiscView): void {
    this.view.set(view);
  }
}
