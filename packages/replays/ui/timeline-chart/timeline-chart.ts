import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import type { ECharts } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { type MapState, type ReplayPlayer, type ReplayTimeline, teamColor } from '../../model';
import { type ChartLook, readChartLook } from '../charts/chart-look';
import { echarts } from '../charts/echarts';
import { teamName } from '../stat-tables/team-rows';
import { TeamPerspective } from '../team-theme/team-perspective';
import { replayDeaths } from './death-lanes';
import { FIGHT_GAP_SECONDS, replayFights, replayTalentPicks } from './timeline-rows';
import { type TimelineChartKind, timelineOptions } from './timeline-chart-options';

/** Each chart's name, for screen readers (the side nav names it on screen). */
const TITLES: Readonly<Record<TimelineChartKind, string>> = {
  deaths: 'Death timeline',
  takedowns: 'Takedowns',
  fights: 'Team fights',
  camps: 'Camps',
  structures: 'Structures',
  'talent-tiers': 'Talent tiers',
};

/** What each chart says when the replay has nothing for it. */
const EMPTY: Readonly<Record<TimelineChartKind, string>> = {
  deaths: 'No one died in this replay.',
  takedowns: 'No one died in this replay.',
  fights: 'There were no fights in this replay.',
  camps: 'This map has no camps.',
  structures: 'This map has no towns.',
  'talent-tiers': 'No talents were picked in this replay.',
};

/** What a chart's marks mean, where that needs saying: under the chart. */
const NOTES: Readonly<Partial<Record<TimelineChartKind, string>>> = {
  fights:
    `A team fight is two or more heroes dying, with at most ${FIGHT_GAP_SECONDS} seconds between ` +
    "each death and the next. Each bar counts one team's players in the fight: in full colour " +
    'those who died, darker those who survived but got takedown credit.',
};

/**
 * One of the charts of a replay's timeline (presentational), coloured from your point of view:
 * each player's dead stretches (`deaths`), who took part in killing whom (`takedowns`), the
 * fights, each camp's captures, the structures each team destroyed, or when each player picked
 * their talents (`talent-tiers`). Along the game's clock, zoom with the wheel or a pinch and pan by
 * dragging.
 */
@Component({
  selector: 'hrs-timeline-chart',
  imports: [NgxEchartsDirective],
  templateUrl: './timeline-chart.html',
  styleUrl: './timeline-chart.scss',
  providers: [provideEchartsCore({ echarts })],
})
export class TimelineChart {
  readonly kind = input.required<TimelineChartKind>();
  readonly timeline = input.required<ReplayTimeline>();
  readonly players = input.required<readonly ReplayPlayer[]>();
  /** For `camps` and `structures`: the map over the game (null until read). */
  readonly map = input<MapState | null>(null);
  /** The game's length on its clock. */
  readonly durationSeconds = input.required<number>();

  private readonly perspective = inject(TeamPerspective);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private chart: ECharts | null = null;

  protected readonly title = computed(() => TITLES[this.kind()]);
  protected readonly note = computed(() => NOTES[this.kind()] ?? null);
  private readonly deaths = computed(() =>
    replayDeaths(
      this.timeline(),
      this.players(),
      this.perspective.yourTeam(),
      this.perspective.mode(),
    ),
  );
  /** The teams, for the legend: your team first. */
  protected readonly teams = computed(() =>
    [...new Set(this.deaths().lanes.map((l) => l.color))]
      .filter((c) => c !== null)
      .map((color) => ({ color, name: teamName(color) })),
  );
  private readonly fights = computed(() => replayFights(this.timeline(), this.deaths().lanes));
  private readonly talents = computed(() =>
    replayTalentPicks(this.timeline(), this.deaths().lanes),
  );
  /** The camps' or structures' map hasn't been read yet. */
  private readonly waiting = computed(
    () => (this.kind() === 'camps' || this.kind() === 'structures') && this.map() === null,
  );
  /** What the chart says instead when the replay has nothing for it; null when it has. */
  protected readonly empty = computed(() => {
    const kind = this.kind();
    if (this.waiting()) return null;
    const count = {
      deaths: this.deaths().spans.length,
      takedowns: this.deaths().takedowns.length,
      fights: this.fights().length,
      camps: this.map()?.camps.length ?? 0,
      structures: this.map()?.towns.length ?? 0,
      'talent-tiers': this.talents().length,
    }[kind];
    return count === 0 ? EMPTY[kind] : null;
  });
  /** Read from the theme once the chart is on the page; the theme only changes in Settings. */
  private readonly look = signal<ChartLook | null>(null);
  protected readonly options = computed(() => {
    const look = this.look();
    return look && !this.waiting()
      ? timelineOptions(this.kind(), {
          deaths: this.deaths(),
          fights: this.fights(),
          map: this.map(),
          colorOf: (team) =>
            team === null
              ? null
              : teamColor(team, this.perspective.yourTeam(), this.perspective.mode()),
          talents: this.talents(),
          teams: this.teams().map((t) => t.color),
          durationSeconds: this.durationSeconds(),
          look,
        })
      : null;
  });

  constructor() {
    afterNextRender(() => this.look.set(readChartLook(this.host)));
  }

  /** Back to the whole game. */
  resetZoom(): void {
    this.chart?.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: 0, end: 100 });
  }

  protected chartReady(chart: ECharts): void {
    this.chart = chart;
  }
}
