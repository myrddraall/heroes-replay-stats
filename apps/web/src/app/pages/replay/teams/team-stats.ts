import { Component, computed, inject, input } from '@angular/core';
import { StatRowHead, StatTable } from '@myrddraall/heroes-replay-stats-common/ui';
import type { TeamStatsRow } from '@myrddraall/heroprotocol-analysis';
import { TeamPerspective } from '../../../team/team-color';
import { TEAM_STAT_GROUPS, teamStatRows } from './team-stat-groups';

/**
 * A replay's team stats (presentational): for each group (combat, XP, structures, camps) a table
 * with a row per team, coloured from your point of view, with its result.
 */
@Component({
  selector: 'hrs-team-stats',
  imports: [StatRowHead, StatTable],
  templateUrl: './team-stats.html',
  styleUrl: './team-stats.scss',
})
export class TeamStats {
  readonly teams = input.required<readonly TeamStatsRow[]>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly groups = computed(() =>
    TEAM_STAT_GROUPS.map((group) => ({
      ...group,
      rows: teamStatRows(
        this.teams(),
        group.columns,
        this.perspective.yourTeam(),
        this.perspective.mode(),
      ),
    })),
  );
}
