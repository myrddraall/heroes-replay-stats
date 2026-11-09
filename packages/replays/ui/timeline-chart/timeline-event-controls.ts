import { Component, computed, model } from '@angular/core';
import {
  MAT_CHECKBOX_DEFAULT_OPTIONS,
  MatCheckbox,
  type MatCheckboxDefaultOptions,
} from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import { eventClip, TIMELINE_EVENTS, type TimelineEventKind } from './game-timeline';

/**
 * The timeline's events shown or hidden (presentational), for the shell's right-hand panel, each
 * with its shape on the chart: Ctrl, Shift or Alt and a click shows only that kind.
 */
@Component({
  selector: 'hrs-timeline-event-controls',
  imports: [MatCheckbox, MatTooltip],
  templateUrl: './timeline-event-controls.html',
  styleUrl: './timeline-event-controls.scss',
  providers: [
    // the checkboxes don't toggle themselves: a click sets what is shown, which they show
    {
      provide: MAT_CHECKBOX_DEFAULT_OPTIONS,
      useValue: { clickAction: 'noop' } satisfies MatCheckboxDefaultOptions,
    },
  ],
})
export class TimelineEventControls {
  /** The kinds of event hidden. */
  readonly hidden = model<readonly TimelineEventKind[]>([]);

  protected readonly events = TIMELINE_EVENTS.map((e) => ({ ...e, clip: eventClip(e) }));
  protected readonly allShown = computed(() => this.hidden().length === 0);
  protected readonly noneShown = computed(() => this.hidden().length === TIMELINE_EVENTS.length);

  protected isShown(kind: TimelineEventKind): boolean {
    return !this.hidden().includes(kind);
  }

  protected toggleAll(): void {
    this.hidden.set(this.allShown() ? TIMELINE_EVENTS.map((e) => e.kind) : []);
  }

  protected choose(kind: TimelineEventKind, event: MouseEvent): void {
    const hidden = this.hidden();
    if (event.ctrlKey || event.shiftKey || event.altKey) {
      this.hidden.set(TIMELINE_EVENTS.map((e) => e.kind).filter((k) => k !== kind));
    } else {
      this.hidden.set(hidden.includes(kind) ? hidden.filter((k) => k !== kind) : [...hidden, kind]);
    }
  }
}
