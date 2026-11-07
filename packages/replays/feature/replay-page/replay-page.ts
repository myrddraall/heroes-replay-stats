import { Component, computed, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellSideTemplate, showShellItem } from '@myrddraall/heroes-replay-stats-shell/feature';
import { TeamPerspective } from '../../ui';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { ReplayFacts, ReplayHeader } from '../../ui';
import { matchSections } from './match-sections';
import { ReplayPageStore } from './replay-page.store';

/**
 * One match, by its replay's id in the address (`/replays/matches/<id>`) (container): the section
 * its child route shows (the score screen, a player stats table); its header (its map and mode) and
 * its facts go over and under its sections in the shell's left-hand drawer (on a handset, which has
 * no such drawer, the header is over the section). While it is open the shell's navigation has
 * it under Replays › Matches, with its sections. The sections read the replay from
 * {@link ReplayPageStore}; teams are coloured from your point of view.
 */
@Component({
  selector: 'hrs-replay-page',
  imports: [
    ReplayFacts,
    EmptyState,
    Layout,
    LayoutItem,
    MatProgressBar,
    ReplayHeader,
    RouterOutlet,
    ShellSideTemplate,
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
            under: '/replays/matches',
            label: replay.map,
            link: `/replays/matches/${replay.id}`,
            sections: matchSections(replay),
          }
        : null;
    });
    inject(TeamPerspective).follow(computed(() => this.store.you().team));
  }
}
