import { PercentPipe } from '@angular/common';
import { Component, inject, input, LOCALE_ID } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { HeroPortrait } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { AwardBadge, formatStat, NO_STAT_VALUE } from '@myrddraall/heroes-replay-stats-replays/ui';
import type { OverviewFigure, PlayerOverviewModel } from './player-overview.presenter';

/**
 * A player's matches at a glance (presentational): the record and the time played, their average
 * match, their connection, their latest results, the heroes they play most and the awards they got.
 */
@Component({
  selector: 'hrs-player-overview',
  imports: [AwardBadge, EmptyState, HeroPortrait, MatTooltip, PercentPipe],
  templateUrl: './player-overview.html',
  styleUrl: './player-overview.scss',
})
export class PlayerOverview {
  readonly overview = input.required<PlayerOverviewModel>();

  private readonly locale = inject(LOCALE_ID);

  protected format(figure: OverviewFigure): string {
    if (figure.format !== 'time') {
      return formatStat(figure.value, { format: figure.format, digits: figure.digits }, this.locale);
    }
    if (figure.value === null) return NO_STAT_VALUE;
    const minutes = Math.round(figure.value / 60);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`;
  }
}
