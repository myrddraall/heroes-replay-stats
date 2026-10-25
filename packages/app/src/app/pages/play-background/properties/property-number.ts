import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { OVERRIDE_SHOWN } from './override-shown';
import { MatIcon } from '@angular/material/icon';
import {
  clamped,
  decimalsOf,
  limitsText,
  SCRUB_DEAD_ZONE,
  scrubRate,
  stepped,
  stepsFor,
  WHEEL_NOTCH,
  wheelPixels,
} from './scrub';

let next = 0;

/** A press on the field being scrubbed: where it was pressed and the number then, and since. */
interface Scrub {
  readonly pointer: number;
  readonly startX: number;
  readonly startY: number;
  /**
   * Whether it was pressed while being typed in: a scrub only once the pointer goes up or down
   * (across, it selects text as usual), what was typed kept first.
   */
  readonly typing: boolean;
  from: number;
  /** Where the pointer is now. */
  y: number;
  /** The number as it goes, before it is kept to its step. */
  exact: number;
  /** Whether the pointer has left the dead zone (else the press was a click, to type). */
  moved: boolean;
  last: number;
  /** The frame it is next changed at (none: not yet scrubbing). */
  frame: number | null;
}

/**
 * A number set on one short row of a properties panel (presentational): its label, the number
 * itself, and its limits beside it. Pressed and dragged up or down, the number changes the faster
 * the further the pointer is from where it was pressed (`scrubRate`), Esc taking it back (being
 * typed in, too: what was typed is kept first; dragged across, its text is selected; its text is
 * never dragged away); clicked, it is typed; the arrow keys, and the wheel over it, step it (`stepsFor`: Shift ten steps, Alt a
 * hundred; the wheel with Ctrl is left to the browser, which zooms, as it does just off the field).
 */
/** A number to so many places, as shown (one that rounds to nothing: no minus sign). */
const fixed = (value: number, places: number) => {
  const text = value.toFixed(places);
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
};

@Component({
  selector: 'hrs-property-number',
  imports: [MatIcon],
  templateUrl: './property-number.html',
  styleUrl: './property-number.scss',
  host: { '[class.row--overridden]': '!!overridden()', '(document:keydown.escape)': 'cancel()' },
})
export class PropertyNumber {
  readonly label = input.required<string>();
  /** Whether it is set here (shown so, with a reset). */
  readonly changed = input(false);
  /** Where its value comes from where it isn't set here (a level under the one edited), if anywhere. */
  readonly origin = input<string>();
  /** The level over the one edited that wins for it, if one does (marked so, and shown when its mark is pressed). */
  readonly overridden = input<string>();
  protected readonly showOverride = inject(OVERRIDE_SHOWN, { optional: true });
  /** Its reset was pressed: back to what it would be. */
  readonly resetRequested = output<void>();
  readonly value = input.required<number>();
  /** How low it may go, if it has a limit that way. */
  readonly min = input<number>();
  /** How high it may go, if it has a limit that way. */
  readonly max = input<number>();
  /** What it is kept to, and how fast it moves: a step a second just past the dead zone. */
  readonly step = input(0.01);
  /** The user scrubbed, stepped or typed it. */
  readonly valueChange = output<number>();
  protected readonly id = `property-number-${next++}`;
  protected readonly shown = computed(() => fixed(this.value(), decimalsOf(this.step())));
  protected readonly limits = computed(() => limitsText(this.min(), this.max()));
  protected readonly scrubbing = signal(false);
  private scrub: Scrub | null = null;
  /** How far the wheel has turned toward the next notch (a trackpad's swipe comes in pieces). */
  private wheeled = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected pressed(event: PointerEvent): void {
    if (event.button !== 0) return;
    const field = event.target as HTMLInputElement;
    // While it is being typed in, a press places the caret as usual until it turns out a scrub.
    const typing = document.activeElement === field;
    const now = this.value();
    this.scrub = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      typing,
      from: now,
      y: event.clientY,
      exact: now,
      moved: false,
      last: performance.now(),
      frame: null,
    };
    if (typing) return;
    event.preventDefault();
    this.begin(field, event.pointerId);
  }

  protected moved(event: PointerEvent): void {
    const s = this.scrub;
    if (!s || event.pointerId !== s.pointer) return;
    s.y = event.clientY;
    const across = Math.abs(event.clientX - s.startX);
    const down = Math.abs(s.y - s.startY);
    if (s.moved || Math.max(across, down) <= SCRUB_DEAD_ZONE) return;
    if (s.typing) {
      // Across: selecting text, as it would be. Up or down: a scrub from what was typed.
      if (across >= down) {
        this.scrub = null;
        return;
      }
      const field = event.target as HTMLInputElement;
      const typed = this.commit(field);
      if (typed !== null) s.from = s.exact = typed;
      field.blur();
      this.begin(field, event.pointerId);
    }
    s.moved = true;
    this.scrubbing.set(true);
  }

  protected released(event: PointerEvent): void {
    const s = this.scrub;
    if (!s || event.pointerId !== s.pointer) return;
    this.stop();
    if (s.moved || s.typing) return;
    const field = event.target as HTMLInputElement;
    field.focus();
    field.select();
  }

  /** The scrub under way: the pointer kept by the field, the number changed each frame. */
  private begin(field: HTMLInputElement, pointer: number): void {
    const s = this.scrub;
    if (!s) return;
    field.setPointerCapture(pointer);
    s.last = performance.now();
    s.frame = requestAnimationFrame((t) => this.tick(t));
  }

  /** Esc while scrubbing: the number back to what it was when pressed. */
  protected cancel(): void {
    const s = this.scrub;
    if (!s) return;
    this.stop();
    if (s.from !== this.value()) this.valueChange.emit(s.from);
  }

  protected keyed(event: KeyboardEvent): void {
    const way = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
    if (!way) return;
    event.preventDefault();
    this.stepBy(way * stepsFor(event));
  }

  protected wheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) return; // the browser's zoom, on the field as off it
    event.preventDefault(); // the panel doesn't scroll (nor, with Alt, the browser go back)
    this.wheeled -= wheelPixels(event); // up: the number up
    const notches = Math.trunc(this.wheeled / WHEEL_NOTCH);
    if (!notches) return;
    this.wheeled -= notches * WHEEL_NOTCH;
    this.stepBy(notches * stepsFor(event));
  }

  private stepBy(steps: number): void {
    this.emit(stepped(this.value() + steps * this.step(), this.step(), this.min(), this.max()));
  }

  protected typed(event: Event): void {
    this.commit(event.target as HTMLInputElement);
  }

  /** What is typed in the field, given (within its limits); none where it isn't a number. */
  private commit(field: HTMLInputElement): number | null {
    const value = Number(field.value.trim().replace(',', '.'));
    if (field.value.trim() === '' || Number.isNaN(value)) {
      field.value = this.shown();
      return null;
    }
    const given = clamped(value, this.min(), this.max());
    field.value = fixed(given, decimalsOf(this.step()));
    this.emit(given);
    return given;
  }

  private tick(now: number): void {
    const s = this.scrub;
    if (!s) return;
    const seconds = Math.min(0.1, (now - s.last) / 1000);
    s.last = now;
    const rate = scrubRate(s.startY - s.y, this.step());
    if (rate) {
      s.exact = clamped(s.exact + rate * seconds, this.min(), this.max());
      this.emit(stepped(s.exact, this.step(), this.min(), this.max()));
    }
    s.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private emit(value: number): void {
    if (value !== this.value()) this.valueChange.emit(value);
  }

  private stop(): void {
    if (this.scrub?.frame != null) cancelAnimationFrame(this.scrub.frame);
    this.scrub = null;
    this.scrubbing.set(false);
  }
}
