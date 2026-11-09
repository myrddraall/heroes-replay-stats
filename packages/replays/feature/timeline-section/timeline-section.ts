import { Component, inject, input, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatProgressBar } from '@angular/material/progress-bar';
import { SidePanel } from '@myrddraall/heroes-replay-stats-common/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellPanelsStore } from '@myrddraall/heroes-replay-stats-shell/data';
import { ShellPanelTemplate } from '@myrddraall/heroes-replay-stats-shell/feature';
import { TimelineChart, type TimelineChartKind } from '../../ui';
import { TimelineSectionStore } from './timeline-section.store';

/**
 * One of the charts of the replay's timeline (container): `/replays/matches/<id>/deaths/<chart>`
 * (timeline, takedowns, fights), `…/map/<chart>` (camps, structures) and `…/xp/talent-tiers`.
 * The chart in the page; the zoom reset (for every chart but the takedowns) in the shell's
 * right-hand panel.
 */
@Component({
  selector: 'hrs-timeline-section',
  imports: [TimelineChart, Layout, MatButton, MatProgressBar, ShellPanelTemplate, SidePanel],
  templateUrl: './timeline-section.html',
  styleUrl: './timeline-section.scss',
  providers: [TimelineSectionStore],
})
export class TimelineSection {
  /** From the route: which chart. */
  readonly chart = input.required<TimelineChartKind>();
  protected readonly store = inject(TimelineSectionStore);
  protected readonly panels = inject(ShellPanelsStore);
  private readonly timelineChart = viewChild(TimelineChart);

  constructor() {
    this.store.show(this.chart);
  }

  protected resetZoom(): void {
    this.timelineChart()?.resetZoom();
  }
}
