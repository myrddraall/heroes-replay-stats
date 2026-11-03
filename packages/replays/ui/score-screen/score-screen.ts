import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import { ScoreTable } from '../stat-tables/score-table/score-table';
import { StatRowHead } from '../stat-tables/stat-row-head';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { ReplayScoreScreen } from '../../model';
import { teamColor } from '../../model';
import { TeamPerspective } from '../team-theme/team-perspective';
import { TeamTheme } from '../team-theme/team-theme';
import { PlayerCell } from '../player-cell/player-cell';
import { playerRows } from '../stat-tables/player-rows';
import { SCORE_COLUMNS } from './score-columns';

/** `MostXPContribution` as `Most XP contribution`. */
export function awardLabel(award: string): string {
  const words = award.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [award];
  return words.map((w, i) => (i === 0 || w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');
}

/**
 * A replay's score screen (presentational): each player's kills, assists, deaths, damage,
 * healing and experience, the best marked, their awards, and each team's result, level and
 * kills; coloured from your point of view.
 */
@Component({
  selector: 'hrs-score-screen',
  imports: [MatIcon, MatTooltip, PlayerCell, ScoreTable, StatRowHead, StyledText, TeamTheme],
  templateUrl: './score-screen.html',
  styleUrl: './score-screen.scss',
})
export class ScoreScreen {
  readonly scoreScreen = input.required<ReplayScoreScreen>();
  /** Each player's hero icon, by slot. */
  readonly icons = input.required<Readonly<Record<number, HeroIcon | null>>>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly columns = SCORE_COLUMNS;
  protected readonly rows = computed(() =>
    playerRows(
      this.scoreScreen().players,
      this.icons(),
      this.columns,
      this.perspective.yourTeam(),
      this.perspective.mode(),
    ),
  );
  /** Whether the replay says who won; without it neither team is shown a result. */
  protected readonly decided = computed(() => this.scoreScreen().teams.some((t) => t.won));
  /** Each team's result, blue first. */
  protected readonly teams = computed(() => {
    const yourTeam = this.perspective.yourTeam();
    const mode = this.perspective.mode();
    return this.scoreScreen()
      .teams.map((team) => {
        const color = teamColor(team.team, yourTeam, mode);
        return {
          ...team,
          name: color === 'blue' ? 'Blue team' : 'Red team',
          blue: color === 'blue',
        };
      })
      .sort((a, b) => Number(b.blue) - Number(a.blue));
  });
  protected readonly awardLabel = awardLabel;
}
