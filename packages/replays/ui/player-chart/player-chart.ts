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
import type { PlayerStatsRow } from '@myrddraall/heroprotocol-analysis';
import type { ECharts } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { ActionsPerMinute, ReplayPlayer, StatColumn } from '../../model';
import { type ChartLook, readChartLook } from '../charts/chart-look';
import { echarts } from '../charts/echarts';
import { teamName } from '../stat-tables/team-rows';
import { TeamPerspective } from '../team-theme/team-perspective';
import {
  chartPlayers,
  PLAYER_COLOURS,
  type PlayerChartKind,
  playerOptions,
} from './player-chart-options';

/** Each chart's name, for screen readers (the side nav names it on screen). */
const TITLES: Readonly<Record<PlayerChartKind, string>> = {
  compare: 'Compare stats',
  apm: 'Actions per minute',
};

/**
 * One of a replay's player charts (presentational), coloured from your point of view: one stat
 * side by side for every player (`compare`), or each player's actions per minute over the game
 * (`apm`; zoom with the wheel or a pinch, pan by dragging).
 */
@Component({
  selector: 'hrs-player-chart',
  imports: [NgxEchartsDirective],
  templateUrl: './player-chart.html',
  styleUrl: './player-chart.scss',
  providers: [provideEchartsCore({ echarts })],
})
export class PlayerChart {
  readonly kind = input.required<PlayerChartKind>();
  readonly players = input.required<readonly ReplayPlayer[]>();
  /** For `compare`: the stat shown and every player's stats (null until read). */
  readonly column = input<StatColumn | null>(null);
  readonly stats = input<readonly PlayerStatsRow[] | null>(null);
  /** For `apm`: each player's commands per minute (null until read), and the players hidden. */
  readonly actions = input<readonly ActionsPerMinute[] | null>(null);
  readonly hidden = input<readonly number[]>([]);
  /** The game's length on its clock. */
  readonly durationSeconds = input.required<number>();

  private readonly perspective = inject(TeamPerspective);
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private chart: ECharts | null = null;

  protected readonly title = computed(() => TITLES[this.kind()]);
  private readonly chartPlayers = computed(() =>
    chartPlayers(this.players(), this.perspective.yourTeam(), this.perspective.mode()),
  );
  /** The players shown, for the APM chart's legend, each in their own colour and line. */
  protected readonly shownPlayers = computed(() =>
    this.chartPlayers().filter((p) => !this.hidden().includes(p.slot)),
  );
  /** The teams, for the legend: your team first. */
  protected readonly teams = computed(() =>
    [...new Set(this.chartPlayers().map((p) => p.color))]
      .filter((c) => c !== null)
      .map((color) => ({ color, name: teamName(color) })),
  );
  /** The data hasn't been read yet. */
  protected readonly loading = computed(() =>
    this.kind() === 'compare' ? this.stats() === null : this.actions() === null,
  );
  private readonly values = computed(() => {
    const column = this.column();
    return Object.fromEntries(
      (this.stats() ?? []).map((row) => {
        const v = column ? (row as unknown as Record<string, unknown>)[column.id] : null;
        return [row.slot, typeof v === 'number' ? v : null];
      }),
    ) as Record<number, number | null>;
  });
  /** Read from the theme once the chart is on the page; the theme only changes in Settings. */
  private readonly look = signal<ChartLook | null>(null);
  protected readonly options = computed(() => {
    const look = this.look();
    return look && !this.loading()
      ? playerOptions(this.kind(), {
          players: this.chartPlayers(),
          column: this.column(),
          values: this.values(),
          actions: this.actions() ?? [],
          hidden: this.hidden(),
          durationSeconds: this.durationSeconds(),
          look,
          locale: this.locale,
        })
      : null;
  });

  constructor() {
    afterNextRender(() =>
      this.look.set(
        readChartLook(
          this.host,
          Array.from({ length: PLAYER_COLOURS }, (_, i) => `player-colour-${i}`),
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
