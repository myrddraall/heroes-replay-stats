import { Component, computed, inject, input } from '@angular/core';
import { ScoreTeamHead } from '../stat-tables/score-row/score-team-head';
import { StatRowHead } from '../stat-tables/stat-row-head';
import { StatTable } from '../stat-tables/stat-table/stat-table';
import type { TeamStatsRow } from '@myrddraall/heroprotocol-analysis';
import { TeamPerspective } from '../team-theme/team-perspective';
import { TEAM_STAT_GROUPS, teamStatRows } from './team-stat-groups';

/**
 * One of a replay's team stats tables (presentational): its group's (combat, XP, structures,
 * camps) columns, a row per team, coloured from your point of view, with its result.
 */
@Component({
  selector: 'hrs-team-stats',
  imports: [ScoreTeamHead, StatRowHead, StatTable],
  templateUrl: './team-stats.html',
  styleUrl: './team-stats.scss',
})
export class TeamStats {
  readonly teams = input.required<readonly TeamStatsRow[]>();
  /** The group shown (`TEAM_STAT_GROUPS`' id: combat, xp, structures, camps). */
  readonly group = input.required<string>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly shown = computed(() => {
    const group = TEAM_STAT_GROUPS.find((g) => g.id === this.group());
    return group
      ? {
          ...group,
          rows: teamStatRows(
            this.teams(),
            group.columns,
            this.perspective.yourTeam(),
            this.perspective.mode(),
          ),
        }
      : null;
  });
}
