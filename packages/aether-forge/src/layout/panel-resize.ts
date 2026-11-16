import { Directive, input, output } from '@angular/core';

/** How narrow and how wide a side panel may be made, in pixels; how far an arrow key moves its edge. */
export const PANEL_MIN = 240;
export const PANEL_MAX = 720;
const KEY_STEP = 16;

/**
 * A side panel's inner edge, dragged to make it wider or narrower (presentational): on a panel at
 * the start, its right edge; at the end, its left. Its width as given (`width`), the new one out
 * as it is dragged (`widthChange`), kept within `PANEL_MIN` and `PANEL_MAX`. From the keyboard
 * (focused, as a separator): the arrow keys move the edge, Home and End take it to its limits.
 */
@Directive({
  selector: '[forgePanelResize]',
  host: {
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'vertical',
    '[attr.aria-valuenow]': 'width()',
    '[attr.aria-valuemin]': 'min',
    '[attr.aria-valuemax]': 'max',
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'up($event)',
    '(keydown)': 'key($event)',
  },
})
export class PanelResize {
  /** Which side the panel is on. */
  readonly forgePanelResize = input.required<'start' | 'end'>();
  readonly width = input.required<number>();
  readonly widthChange = output<number>();
  protected readonly min = PANEL_MIN;
  protected readonly max = PANEL_MAX;
  /** The drag going on: its pointer, where it began, the width then. */
  private dragging?: { readonly id: number; readonly x: number; readonly width: number };

  protected down(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    // (Kept on it as the pointer goes over the view; a pointer the browser no longer has can't be.)
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    this.dragging = { id: event.pointerId, x: event.clientX, width: this.width() };
  }

  protected move(event: PointerEvent): void {
    const d = this.dragging;
    if (!d || event.pointerId !== d.id) return;
    // Out from the panel: wider (a start panel's edge to the right, an end one's to the left).
    const out = (event.clientX - d.x) * (this.forgePanelResize() === 'start' ? 1 : -1);
    this.set(d.width + out);
  }

  protected up(event: PointerEvent): void {
    if (this.dragging?.id === event.pointerId) this.dragging = undefined;
  }

  protected key(event: KeyboardEvent): void {
    const outward = this.forgePanelResize() === 'start' ? 'ArrowRight' : 'ArrowLeft';
    const inward = this.forgePanelResize() === 'start' ? 'ArrowLeft' : 'ArrowRight';
    const next =
      event.key === outward
        ? this.width() + KEY_STEP
        : event.key === inward
          ? this.width() - KEY_STEP
          : event.key === 'Home'
            ? PANEL_MIN
            : event.key === 'End'
              ? PANEL_MAX
              : null;
    if (next === null) return;
    event.preventDefault();
    this.set(next);
  }

  private set(width: number): void {
    const next = Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, width)));
    if (next !== this.width()) this.widthChange.emit(next);
  }
}
