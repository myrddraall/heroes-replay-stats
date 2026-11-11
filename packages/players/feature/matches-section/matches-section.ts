import { Component, computed, inject } from '@angular/core';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ViewedReplaysStore } from '@myrddraall/heroes-replay-stats-replays/data';
import { ReplayList, toReplayCard } from '@myrddraall/heroes-replay-stats-replays/ui';
import { PlayerPageStore } from '../player-page';

/**
 * The player's matches (container), from their page's store, as the match list's cards with the
 * player as "you" in each: `/replays/players/<id>/matches`.
 */
@Component({
  selector: 'hrs-player-matches-section',
  imports: [Layout, ReplayList],
  template: `<hrs-layout>
    <hrs-replay-list [cards]="cards()" [total]="store.all().length" [loaded]="true" />
  </hrs-layout>`,
})
export class MatchesSection {
  protected readonly store = inject(PlayerPageStore);
  private readonly viewed = inject(ViewedReplaysStore);
  protected readonly cards = computed(() => {
    const heroes = this.store.heroes();
    const seen = this.viewed.seen();
    return this.store.games().map((game) => ({
      // the card of the match itself, seen from this player's side
      ...toReplayCard(game.replay, new Set(), heroes, seen[game.replay.id]),
      you: game.you,
    }));
  });
}
