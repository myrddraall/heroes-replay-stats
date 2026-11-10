import { Component, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { SidePanel } from '@myrddraall/heroes-replay-stats-common/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { StatColumnPicker, StatPresets } from '../../ui';
import { ShellPanelsStore } from '@myrddraall/heroes-replay-stats-shell/data';
import { ShellPanelTemplate } from '@myrddraall/heroes-replay-stats-shell/feature';
import { PlayerStats } from '../../ui';
import type { StatSectionId } from '../../model';
import { StatsSectionStore } from './stats-section.store';

/**
 * One player stats section of the replay (container): `/replays/matches/<id>/players/<section>`. The table
 * in the page; the presets and the column choice in the shell's right-hand panel.
 */
@Component({
  selector: 'hrs-stats-section',
  imports: [
    Layout,
    MatProgressBar,
    PlayerStats,
    ShellPanelTemplate,
    SidePanel,
    StatColumnPicker,
    StatPresets,
  ],
  templateUrl: './stats-section.html',
  providers: [StatsSectionStore],
})
export class StatsSection {
  /** From the route's data. */
  readonly section = input.required<StatSectionId>();
  protected readonly store = inject(StatsSectionStore);
  protected readonly panels = inject(ShellPanelsStore);

  constructor() {
    this.store.show(this.section);
  }
}
