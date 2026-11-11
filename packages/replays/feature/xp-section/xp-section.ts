import { Component, computed, inject, input, viewChild } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { SidePanel } from '@myrddraall/heroes-replay-stats-common/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellPanelsStore } from '@myrddraall/heroes-replay-stats-shell/data';
import { ShellPanelTemplate } from '@myrddraall/heroes-replay-stats-shell/feature';
import { teamColor } from '../../model';
import {
  TeamPerspective,
  teamName,
  XpChart,
  XpChartControls,
  type XpChartKind,
  type XpChartTeam,
} from '../../ui';
import { XpSectionStore } from './xp-section.store';

/**
 * One of the replay's XP charts (container): `/replays/matches/<id>/xp/<chart>` (over-time,
 * per-minute, advantage, sources). The chart in the page; its controls in the shell's right-hand
 * panel.
 */
@Component({
  selector: 'hrs-xp-section',
  imports: [Layout, MatProgressBar, ShellPanelTemplate, SidePanel, XpChart, XpChartControls],
  templateUrl: './xp-section.html',
  providers: [XpSectionStore],
})
export class XpSection {
  /** From the route: which chart. */
  readonly chart = input.required<XpChartKind>();
  protected readonly store = inject(XpSectionStore);
  protected readonly panels = inject(ShellPanelsStore);
  private readonly perspective = inject(TeamPerspective);
  private readonly xpChart = viewChild(XpChart);

  /** The teams to choose between on the sources chart, your team first; none on the others. */
  protected readonly teams = computed((): XpChartTeam[] => {
    if (this.chart() !== 'sources') return [];
    const teams = [...new Set(this.store.players().map((p) => p.team))].filter((t) => t !== null);
    return teams
      .map((team) => {
        const color = teamColor(team, this.perspective.yourTeam(), this.perspective.mode());
        return { team, color, name: teamName(color) };
      })
      .sort((a, b) => Number(a.color !== 'blue') - Number(b.color !== 'blue'));
  });
  /** The team the sources chart shows: the one chosen, else your team. */
  protected readonly team = computed(() => this.store.team() ?? this.teams()[0]?.team ?? null);

  constructor() {
    this.store.show(this.chart);
  }

  protected resetZoom(): void {
    this.xpChart()?.resetZoom();
  }
}
