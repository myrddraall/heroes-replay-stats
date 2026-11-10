import { Component, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { MatchFilters } from '@myrddraall/heroes-replay-stats-replays/ui';
import { ShellSideTemplate, showShellItem } from '@myrddraall/heroes-replay-stats-shell/feature';
import { PlayerCard } from '../../ui';
import { playerLink, playerSections } from './player-sections';
import { PlayerPageStore } from './player-page.store';

/**
 * One player, by their id in the address (`/replays/players/<id>`) (container): their stats across
 * the stored replays, in the section its child route shows; their card goes over the sections in
 * the shell's left-hand drawer (on a handset, which has no such drawer, over the section). The
 * filter over the section narrows the matches every section counts. While it is open the shell's
 * navigation has the player under Replays › Players, with the sections. The sections read the
 * matches from {@link PlayerPageStore}.
 */
@Component({
  selector: 'hrs-player-page',
  imports: [
    EmptyState,
    Layout,
    LayoutItem,
    MatchFilters,
    MatProgressBar,
    PlayerCard,
    RouterOutlet,
    ShellSideTemplate,
  ],
  templateUrl: './player-page.html',
  styleUrl: './player-page.scss',
  providers: [PlayerPageStore],
})
export class PlayerPage {
  /** From the route. */
  readonly playerId = input.required<string>();
  protected readonly store = inject(PlayerPageStore);

  constructor() {
    this.store.show(this.playerId);
    showShellItem(() => {
      const player = this.store.player();
      return player
        ? {
            under: '/replays/players',
            label: player.name,
            link: playerLink(player.id),
            sections: playerSections(player.id),
          }
        : null;
    });
  }
}
