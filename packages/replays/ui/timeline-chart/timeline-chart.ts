import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import type { ECharts } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import {
  type MapState,
  playerTheme,
  type ReplayPlayer,
  type ReplayTimeline,
  type StatRowTheme,
  teamColor,
  type TeamColor,
} from '../../model';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import { ScoreRowBar } from '../stat-tables/score-row/score-row-bar';
import { ScoreRowHead } from '../stat-tables/score-row/score-row-head';
import { ScoreTeamHead } from '../stat-tables/score-row/score-team-head';
import { type ChartLook, readChartLook, readThemedColours } from '../charts/chart-look';
import { echarts } from '../charts/echarts';
import { teamName } from '../stat-tables/team-rows';
import { TeamPerspective } from '../team-theme/team-perspective';
import { replayDeaths } from './death-lanes';
import {
  eventClip,
  gameTimeline,
  PLAYER_STATE_COLOURS,
  PLAYER_STATE_KEY,
  type PlayerStateKey,
  TIMELINE_EVENTS,
  type TimelineEventKind,
} from './game-timeline';
import { FIGHT_GAP_SECONDS, replayFights, replayTalentPicks } from './timeline-rows';
import { campNames } from './map-names';
import { structureRows, type TimelineChartKind, timelineOptions } from './timeline-chart-options';

/** A row's head beside the chart: a team's, a player's, or a camp's, town's or core's. */
type TimelineHead =
  | {
      readonly kind: 'label';
      readonly key: string;
      readonly theme: TeamColor | null;
      readonly name: string;
      /** Under the name, smaller (a town's hall); none for the others. */
      readonly sub: string | null;
    }
  | {
      readonly kind: 'team';
      readonly key: string;
      readonly theme: TeamColor | null;
      readonly name: string;
      readonly result: string | null;
    }
  | {
      readonly kind: 'player';
      readonly key: string;
      readonly theme: StatRowTheme | null;
      readonly hero: string;
      readonly name: string;
      readonly portrait: HeroIcon | null;
    };

/** Each chart's name, for screen readers (the side nav names it on screen). */
const TITLES: Readonly<Record<TimelineChartKind, string>> = {
  timeline: 'Timeline',
  takedowns: 'Takedowns',
  fights: 'Team fights',
  camps: 'Camps',
  structures: 'Structures',
  'talent-tiers': 'Talent tiers',
};

/** What each chart says when the replay has nothing for it. */
const EMPTY: Readonly<Record<TimelineChartKind, string>> = {
  timeline: 'This replay has no timeline.',
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
 * the game over time (`timeline`: each player alive and dead, their talent picks, each team's
 * levels, captures and structures), who took part in killing whom (`takedowns`), the
 * fights, each camp's captures, the structures each team destroyed, or when each player picked
 * their talents (`talent-tiers`). Along the game's clock, zoom with the wheel or a pinch and pan by
 * dragging.
 */
@Component({
  selector: 'hrs-timeline-chart',
  imports: [NgxEchartsDirective, ScoreRowBar, ScoreRowHead, ScoreTeamHead, StyledText],
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
  /** For `timeline`: talents' names by the game's id. */
  readonly talentNames = input<Readonly<Record<string, string>>>({});
  /** For `timeline`: the kinds of event not shown. */
  readonly hidden = input<readonly TimelineEventKind[]>([]);
  /** For `timeline`: each player's hero leaderboard portrait, by slot (the row heads'). */
  readonly portraits = input<Readonly<Record<number, HeroIcon | null>>>({});
  /** For `timeline`: your slots, whose rows are in your self theme, as the tables'. */
  readonly you = input<readonly number[]>([]);

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
  private readonly colorOf = (team: Team | null): TeamColor | null =>
    team === null ? null : teamColor(team, this.perspective.yourTeam(), this.perspective.mode());
  /** For `timeline`: the game as a timeline; null for the other charts. */
  private readonly game = computed(() =>
    this.kind() === 'timeline'
      ? gameTimeline({
          timeline: this.timeline(),
          deaths: this.deaths(),
          map: this.map(),
          talentNames: this.talentNames(),
          colorOf: this.colorOf,
          teamName: (color) => (color ? teamName(color) : 'A team'),
          durationSeconds: this.durationSeconds(),
        })
      : null,
  );
  /** The charts whose rows have heads beside them, as the tables' rows. */
  protected readonly hasHeads = computed(() =>
    (['timeline', 'camps', 'structures'] as TimelineChartKind[]).includes(this.kind()),
  );
  /**
   * Each row's head beside the chart, as the tables' rows: on the timeline a team's or a player's;
   * on the camps and structures a camp's, town's or core's name.
   */
  protected readonly heads = computed((): TimelineHead[] => {
    const kind = this.kind();
    const map = this.map();
    // the camps' and structures' rows: a name (and a town's hall), in its side's colour
    if (kind === 'camps')
      return campNames(map?.camps ?? []).map((name, i) => ({
        kind: 'label',
        key: `camp ${i}`,
        theme: null,
        name,
        sub: null,
      }));
    if (kind === 'structures')
      return structureRows(
        map,
        this.colorOf,
        this.teams().map((t) => t.color),
        this.durationSeconds(),
      ).map((row, i) => ({
        kind: 'label',
        key: `structure ${i}`,
        theme: this.colorOf(row.team),
        name: row.name,
        sub: row.sub,
      }));
    const game = this.game();
    if (!game) return [];
    const { lanes } = this.deaths();
    const you = new Set(this.you());
    return game.rows.map((row, i): TimelineHead => {
      if (row.kind === 'team') {
        const won = this.players()
          .filter((p) => p.team === row.team)
          .map((p) => p.won);
        const decided = won.some((w) => w !== null);
        return {
          kind: 'team',
          key: `team ${i}`,
          theme: row.color,
          name: row.color ? teamName(row.color) : 'Team',
          result: decided ? (won.includes(true) ? 'Victory' : 'Defeat') : null,
        };
      }
      const lane = lanes[row.lane]!;
      return {
        kind: 'player',
        key: `slot ${lane.slot}`,
        theme: lane.color ? playerTheme(lane.color, you.has(lane.slot)) : null,
        hero: lane.hero,
        name: lane.name,
        portrait: this.portraits()[lane.slot] ?? null,
      };
    });
  });
  /** For `timeline`: the players' stretches other than alive, in the legend. */
  protected readonly states = PLAYER_STATE_KEY;
  /** For `timeline`: the teams' themes the stretches are drawn in. */
  protected readonly rowTeams: readonly TeamColor[] = ['blue', 'red'];
  private readonly rowProbes = viewChildren('rowProbe', { read: ElementRef<HTMLElement> });
  /** For `timeline`: the kinds of event in the legend, with their shapes. */
  protected readonly events = computed(() =>
    this.kind() === 'timeline'
      ? TIMELINE_EVENTS.filter((e) => !this.hidden().includes(e.kind)).map((e) => ({
          ...e,
          clip: eventClip(e),
        }))
      : [],
  );
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
      timeline: this.deaths().lanes.length,
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
          game: this.game(),
          hidden: this.hidden(),
          fights: this.fights(),
          map: this.map(),
          colorOf: this.colorOf,
          talents: this.talents(),
          teams: this.teams().map((t) => t.color),
          durationSeconds: this.durationSeconds(),
          look,
        })
      : null;
  });

  constructor() {
    // the timeline's marks: light, with a ring of the surface they sit on
    afterNextRender(() =>
      this.look.set({
        ...readChartLook(this.host, ['mat-sys-on-surface', 'mat-sys-surface']),
        themed: readThemedColours(
          this.rowProbes().map((p) => p.nativeElement),
          PLAYER_STATE_COLOURS,
        ),
      }),
    );
  }

  /** A state's stretch in the key: its fill over its line, as the chart draws it. */
  protected stateBackground(key: PlayerStateKey): string {
    return (
      `linear-gradient(to top, var(--${key}-line) 2px, transparent 2px), ` +
      `linear-gradient(var(--${key}-top), var(--${key}-bottom))`
    );
  }

  /** Back to the whole game. */
  resetZoom(): void {
    this.chart?.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: 0, end: 100 });
  }

  protected chartReady(chart: ECharts): void {
    this.chart = chart;
  }
}
