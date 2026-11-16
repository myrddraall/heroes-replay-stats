import { Component, computed, input, model, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {
  MAT_CHECKBOX_DEFAULT_OPTIONS,
  MatCheckbox,
  type MatCheckboxDefaultOptions,
} from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { TeamColor } from '../../model';
import { XP_SOURCES, type XpSource } from './xp-curves';

/**
 * An XP chart's controls (presentational), for the shell's right-hand panel: the team shown, for
 * a chart of one team at a time (when `teams` are given), the sources counted (Ctrl, Shift or Alt
 * and a click counts only that one; the last one counted stays) and a reset of the chart's zoom.
 */
/** A team to choose, by its name and colour from your point of view. */
export interface XpChartTeam {
  readonly team: Team;
  readonly name: string;
  readonly color: TeamColor;
}

@Component({
  selector: 'hrs-xp-chart-controls',
  imports: [MatButton, MatButtonToggle, MatButtonToggleGroup, MatCheckbox, MatTooltip],
  templateUrl: './xp-chart-controls.html',
  styleUrl: './xp-chart-controls.scss',
  providers: [
    // the checkboxes don't toggle themselves: a click sets what is counted, which they show
    {
      provide: MAT_CHECKBOX_DEFAULT_OPTIONS,
      useValue: { clickAction: 'noop' } satisfies MatCheckboxDefaultOptions,
    },
  ],
})
export class XpChartControls {
  /** The teams to choose between, for a chart of one team at a time; none for the others. */
  readonly teams = input<readonly XpChartTeam[]>([]);
  readonly team = model<Team | null>(null);
  /** The sources counted, in the order `XP_SOURCES` lists them. */
  readonly counted = model.required<readonly XpSource[]>();
  /** Back to the whole game. */
  readonly resetZoomRequested = output<void>();

  protected readonly sources = XP_SOURCES;
  protected readonly allCounted = computed(() => this.counted().length === XP_SOURCES.length);

  protected isCounted(source: XpSource): boolean {
    return this.counted().includes(source);
  }

  protected countAll(): void {
    if (!this.allCounted()) this.counted.set(XP_SOURCES.map((s) => s.id));
  }

  protected choose(source: XpSource, event: MouseEvent): void {
    const counted = this.counted();
    if (event.ctrlKey || event.shiftKey || event.altKey) {
      this.counted.set([source]);
    } else if (!counted.includes(source)) {
      this.counted.set(
        XP_SOURCES.map((s) => s.id).filter((id) => id === source || counted.includes(id)),
      );
    } else if (counted.length > 1) {
      this.counted.set(counted.filter((id) => id !== source));
    }
  }
}
