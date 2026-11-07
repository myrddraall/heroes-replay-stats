import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { ScoreScreenTeamRow } from '@myrddraall/heroprotocol-analysis';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import { teamColor } from '../../../model';
import { TeamPerspective } from '../../team-theme/team-perspective';
import { TeamTheme } from '../../team-theme/team-theme';

/**
 * The teams' totals across the bottom of the game's score and talent screens (GameStatsPanel's
 * BlueTeamStats, RedTeamStats; TalentsOverviewPanel's): each side centred in its half, its name over
 * its level, its kills large and its kills icon, "VS" between, coloured from your point of view (the
 * `TeamPerspective` above it). Sized from the score rows' height, and its card's width where that is
 * narrow (the card an inline-size container).
 */
@Component({
  selector: 'ui-score-teams',
  imports: [MatIcon, StyledText, TeamTheme],
  templateUrl: './score-teams.html',
  styleUrl: './score-teams.scss',
})
export class ScoreTeams {
  readonly teams = input.required<readonly ScoreScreenTeamRow[]>();
  private readonly perspective = inject(TeamPerspective);
  /**
   * Each team's totals, blue first: named for you ("My Team", "Enemy Team") when you're known, by
   * their colour otherwise.
   */
  protected readonly shown = computed(() => {
    const yourTeam = this.perspective.yourTeam();
    const mode = this.perspective.mode();
    return this.teams()
      .map((team) => {
        const color = teamColor(team.team, yourTeam, mode);
        const name =
          yourTeam === null
            ? color === 'blue'
              ? 'Blue Team'
              : 'Red Team'
            : team.team === yourTeam
              ? 'My Team'
              : 'Enemy Team';
        return { ...team, name, blue: color === 'blue' };
      })
      .sort((a, b) => Number(b.blue) - Number(a.blue));
  });
}
