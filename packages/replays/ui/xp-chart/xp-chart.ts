import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';
import type { XpPointRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { ReplayPlayer, ReplayTimeline } from '../../model';
import { type ChartLook, readChartLook } from '../charts/chart-look';
import { echarts } from '../charts/echarts';
import { gameEvents } from '../charts/game-events';
import type { ECharts } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { TeamPerspective } from '../team-theme/team-perspective';
import { type XpChartKind, xpOptions } from './xp-chart-options';
import { XP_SOURCES, type XpSource, xpCurves } from './xp-curves';

/** Each chart's name, for screen readers (the side nav names it on screen). */
const TITLES: Readonly<Record<XpChartKind, string>> = {
  'over-time': 'XP over time',
  'per-minute': 'XP per minute',
  advantage: 'XP advantage',
  sources: 'XP by source',
};

/**
 * One of a replay's XP charts (presentational), coloured from your point of view, counting the
 * sources given: each team's XP over the game with a level axis (`over-time`), the XP each team
 * gained per minute (`per-minute`), the lead one team had over the other with the game's turns in
 * its tooltip (`advantage`, which needs the `timeline` and `players`), or one `team`'s XP stacked
 * by source (`sources`). Zoom with the wheel or a pinch, pan by dragging; its controls are
 * `hrs-xp-chart-controls`.
 */
@Component({
  selector: 'hrs-xp-chart',
  imports: [NgxEchartsDirective],
  templateUrl: './xp-chart.html',
  styleUrl: './xp-chart.scss',
  providers: [provideEchartsCore({ echarts })],
})
export class XpChart {
  readonly points = input.required<readonly XpPointRow[]>();
  readonly kind = input.required<XpChartKind>();
  /** The sources counted. */
  readonly counted = input.required<readonly XpSource[]>();
  /** For the advantage chart's turns: the replay's timeline (null until read) and players. */
  readonly timeline = input<ReplayTimeline | null>(null);
  readonly players = input<readonly ReplayPlayer[]>([]);
  /** For the sources chart: the team shown. */
  readonly team = input<Team | null>(null);

  private readonly perspective = inject(TeamPerspective);
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private chart: ECharts | null = null;

  protected readonly curves = computed(() =>
    xpCurves(this.points(), this.counted(), this.perspective.yourTeam(), this.perspective.mode()),
  );
  protected readonly title = computed(() => TITLES[this.kind()]);
  private readonly events = computed(() => {
    const timeline = this.timeline();
    return timeline
      ? gameEvents(timeline, this.players(), this.perspective.yourTeam(), this.perspective.mode())
      : [];
  });
  /** Read from the theme once the chart is on the page; the theme only changes in Settings. */
  private readonly look = signal<ChartLook | null>(null);
  protected readonly options = computed(() => {
    const look = this.look();
    if (!look) return null;
    return xpOptions(this.kind(), {
      curves: this.curves(),
      chosen: this.counted(),
      look,
      locale: this.locale,
      events: this.events(),
      team: this.team(),
    });
  });

  constructor() {
    afterNextRender(() =>
      this.look.set(
        readChartLook(
          this.host,
          XP_SOURCES.map((s) => `xp-source-${s.id}`),
        ),
      ),
    );
  }

  /** Back to the whole game. */
  resetZoom(): void {
    for (const dataZoomIndex of [0, 1]) {
      this.chart?.dispatchAction({ type: 'dataZoom', dataZoomIndex, start: 0, end: 100 });
    }
  }

  protected chartReady(chart: ECharts): void {
    this.chart = chart;
  }
}
