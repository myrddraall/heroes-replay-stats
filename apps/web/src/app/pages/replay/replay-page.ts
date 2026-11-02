import { Component, computed, inject, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellNavChildren } from '@myrddraall/heroes-replay-stats-shell/feature';
import { TeamPerspective } from '@myrddraall/heroes-replay-stats-replays/ui';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { ReplayHeader } from './replay-header';
import { ReplayNav } from './replay-nav';
import { ReplayPageStore } from './replay-page.store';
import { REPLAY_PAGES } from './replay-pages';

/**
 * One replay, by its id in the address (`/replays/<id>`) (container): its header and the page its
 * child route shows (the score screen, a player stats table), with its pages listed in the main nav
 * under Replays while it is open. The sections read the replay
 * from {@link ReplayPageStore}; teams are coloured from your point of view.
 */
@Component({
  selector: 'hrs-replay-page',
  imports: [
    EmptyState,
    Layout,
    LayoutItem,
    MatProgressBar,
    ReplayHeader,
    ReplayNav,
    RouterOutlet,
    ShellNavChildren,
  ],
  templateUrl: './replay-page.html',
  styleUrl: './replay-page.scss',
  providers: [ReplayPageStore, TeamPerspective],
})
export class ReplayPage {
  /** From the route. */
  readonly replayId = input.required<string>();
  protected readonly store = inject(ReplayPageStore);
  protected readonly pages = REPLAY_PAGES;

  constructor() {
    this.store.show(this.replayId);
    inject(TeamPerspective).follow(computed(() => this.store.you().team));
  }
}
