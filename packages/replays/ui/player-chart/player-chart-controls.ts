import { Component, computed, input, model, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_CHECKBOX_DEFAULT_OPTIONS,
  MatCheckbox,
  type MatCheckboxDefaultOptions,
} from '@angular/material/checkbox';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import type { StatColumn } from '../../model';
import type { ChartPlayer } from './player-chart-options';

/**
 * A player chart's controls (presentational), for the shell's right-hand panel: the stat compared
 * (when `columns` are given), the players shown (when `players` are given: Ctrl, Shift or Alt and
 * a click shows only that one; the last one shown stays) and a reset of the chart's zoom (when it
 * zooms).
 */
@Component({
  selector: 'hrs-player-chart-controls',
  imports: [MatButton, MatCheckbox, MatFormField, MatLabel, MatOption, MatSelect, MatTooltip],
  templateUrl: './player-chart-controls.html',
  styleUrl: './player-chart-controls.scss',
  providers: [
    // the checkboxes don't toggle themselves: a click sets who is shown, which they show
    {
      provide: MAT_CHECKBOX_DEFAULT_OPTIONS,
      useValue: { clickAction: 'noop' } satisfies MatCheckboxDefaultOptions,
    },
  ],
})
export class PlayerChartControls {
  /** The stats to choose from; none for a chart without a choice. */
  readonly columns = input<readonly StatColumn[]>([]);
  readonly column = model<string | null>(null);
  /** The players to show or hide, your team first; none for a chart without the choice. */
  readonly players = input<readonly ChartPlayer[]>([]);
  /** The slots of the players hidden. */
  readonly hidden = model<readonly number[]>([]);
  /** The chart zooms: offer the reset. */
  readonly zooms = input(false);
  /** Back to the whole game. */
  readonly resetZoomRequested = output<void>();

  protected readonly allShown = computed(() => this.hidden().length === 0);

  protected isShown(slot: number): boolean {
    return !this.hidden().includes(slot);
  }

  protected showAll(): void {
    if (!this.allShown()) this.hidden.set([]);
  }

  protected choose(slot: number, event: MouseEvent): void {
    const slots = this.players().map((p) => p.slot);
    const hidden = this.hidden();
    if (event.ctrlKey || event.shiftKey || event.altKey) {
      this.hidden.set(slots.filter((s) => s !== slot));
    } else if (hidden.includes(slot)) {
      this.hidden.set(hidden.filter((s) => s !== slot));
    } else if (slots.length - hidden.length > 1) {
      this.hidden.set([...hidden, slot]);
    }
  }
}
