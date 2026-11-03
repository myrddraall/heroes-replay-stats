import { Component, computed, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellSideNav, showShellItem } from '@myrddraall/heroes-replay-stats-shell/feature';
import { TeamPerspective } from '../../ui';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { ReplayHeader } from '../../ui';
import { matchSections } from './match-sections';
import { ReplayPageStore } from './replay-page.store';

/**
 * One match, by its replay's id in the address (`/matches/<id>`) (container): its header and the
 * section its child route shows (the score screen, a player stats table), with the side nav of the
 * section's own sections beside it. While it is open the shell's navigation has it under Matches,
 * with its sections. The sections read the replay from {@link ReplayPageStore}; teams are coloured
 * from your point of view.
 */
@Component({
  selector: 'hrs-replay-page',
  imports: [
    EmptyState,
    Layout,
    LayoutItem,
    MatProgressBar,
    ReplayHeader,
    RouterOutlet,
    ShellSideNav,
  ],
  templateUrl: './replay-page.html',
  styleUrl: './replay-page.scss',
  providers: [ReplayPageStore, TeamPerspective],
})
export class ReplayPage {
  /** From the route. */
  readonly replayId = input.required<string>();
  protected readonly store = inject(ReplayPageStore);

  constructor() {
    this.store.show(this.replayId);
    showShellItem(() => {
      const replay = this.store.replay();
      return replay
        ? {
            under: '/matches',
            label: replay.map,
            link: `/matches/${replay.id}`,
            sections: matchSections(replay.id),
          }
        : null;
    });
    inject(TeamPerspective).follow(computed(() => this.store.you().team));
  }
}
