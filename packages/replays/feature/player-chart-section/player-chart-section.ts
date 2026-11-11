import { Component, computed, inject, input, viewChild } from '@angular/core';
import { SidePanel } from '@myrddraall/heroes-replay-stats-common/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellPanelsStore } from '@myrddraall/heroes-replay-stats-shell/data';
import { ShellPanelTemplate } from '@myrddraall/heroes-replay-stats-shell/feature';
import {
  chartPlayers,
  PlayerChart,
  type PlayerChartKind,
  PlayerChartControls,
  TeamPerspective,
} from '../../ui';
import { PlayerChartSectionStore } from './player-chart-section.store';

/**
 * One of the replay's player charts (container): `/replays/matches/<id>/players/compare` and
 * `/replays/matches/<id>/players/apm`. The chart in the page; the stat compared or the zoom reset
 * in the shell's right-hand panel.
 */
@Component({
  selector: 'hrs-player-chart-section',
  imports: [Layout, PlayerChart, PlayerChartControls, ShellPanelTemplate, SidePanel],
  templateUrl: './player-chart-section.html',
  providers: [PlayerChartSectionStore],
})
export class PlayerChartSection {
  /** From the route: which chart. */
  readonly chart = input.required<PlayerChartKind>();
  protected readonly store = inject(PlayerChartSectionStore);
  protected readonly panels = inject(ShellPanelsStore);
  private readonly perspective = inject(TeamPerspective);
  private readonly playerChart = viewChild(PlayerChart);

  /** The players to show or hide on the APM chart, your team first; none on the comparison. */
  protected readonly choosablePlayers = computed(() =>
    this.chart() === 'apm'
      ? chartPlayers(this.store.players(), this.perspective.yourTeam(), this.perspective.mode())
      : [],
  );

  constructor() {
    this.store.show(this.chart);
  }

  protected resetZoom(): void {
    this.playerChart()?.resetZoom();
  }
}
