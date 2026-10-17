import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** A direction in a planet's frame: x to the right, y away from the eye, z up. */
export type Direction = readonly [number, number, number];

let next = 0;
/** How far an arrow key moves the point, as a share of the disc's radius. */
const KEY_STEP = 0.05;

/**
 * A direction on one short row of a properties panel (presentational), as a point on a disc that
 * is the planet's face as the eye sees it: dragged (or moved with the arrow keys) to where on the
 * face the direction points; on the near side of the planet, or on the far side where `back` is
 * allowed (a hollow point; a switch beside the disc flips it).
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
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  readonly value = input.required<Direction>();
  /** Whether it may point to the far side. */
  readonly back = input(false);
  readonly valueChange = output<Direction>();
  protected readonly id = `property-direction-${next++}`;

  /** Where the point is on the disc, as shares of its radius from its centre (right, down). */
  protected readonly point = computed(() => {
    const [x, , z] = this.unit();
    return { x, y: -z };
  });
  /** Where the point is round the disc, in degrees clockwise from the top (for assistive technology). */
  protected readonly angle = computed(() => {
    const { x, y } = this.point();
    return Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360);
  });
  /** Whether it points to the far side. */
  protected readonly behind = computed(() => this.unit()[1] > 0);
  protected readonly text = computed(() => {
    const [x, y, z] = this.unit();
    const side = (v: number, plus: string, minus: string) =>
      Math.abs(v) < 0.15 ? '' : `${Math.round(Math.abs(v) * 100)}% ${v > 0 ? plus : minus}`;
    const parts = [side(x, 'right', 'left'), side(z, 'up', 'down')].filter(Boolean);
    return `${parts.length ? parts.join(', ') : 'centre'}, ${y > 0 ? 'far side' : 'near side'}`;
  });

  private unit(): Direction {
    const [x, y, z] = this.value();
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }

  /** The direction for a point on the disc, on the side it is on now. */
  private at(x: number, down: number, behind = this.behind()): Direction {
    let px = x;
    let pz = -down;
    const r = Math.hypot(px, pz);
    if (r > 1) {
      px /= r;
      pz /= r;
    }
    const depth = Math.sqrt(Math.max(0, 1 - px * px - pz * pz));
    return [px, behind ? depth : -depth, pz];
  }

  protected pointerDown(event: PointerEvent): void {
    const disc = event.currentTarget as HTMLElement;
    disc.setPointerCapture(event.pointerId);
    this.pointerMove(event);
  }

  protected pointerMove(event: PointerEvent): void {
    const disc = event.currentTarget as HTMLElement;
    if (!disc.hasPointerCapture(event.pointerId)) return;
    const box = disc.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const down = ((event.clientY - box.top) / box.height) * 2 - 1;
    this.valueChange.emit(this.at(x, down));
  }

  protected key(event: KeyboardEvent): void {
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

  protected flip(): void {
    const { x, y } = this.point();
    this.valueChange.emit(this.at(x, y, !this.behind()));
  }
}
