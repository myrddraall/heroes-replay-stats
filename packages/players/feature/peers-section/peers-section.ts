import { Component, computed, inject, input } from '@angular/core';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { playerPeers } from '../../model';
import { PlayerPeers } from '../../ui';
import { PlayerPageStore } from '../player-page';

/** Which side of the player's matches a peers section lists. */
export type PeersSide = 'with' | 'against';

const LABELS: Readonly<Record<PeersSide, { title: string; record: string }>> = {
  with: { title: 'Teammates', record: 'Record together' },
  against: { title: 'Opponents', record: 'Record against' },
};

/**
 * The people the player shared matches with on one side (container), from their page's store:
 * `/replays/players/<id>/players/teammates` and `…/opponents`.
 */
@Component({
  selector: 'hrs-player-peers-section',
  imports: [Layout, PlayerPeers],
  template: `<hrs-layout>
    <hrs-player-peers [title]="labels().title" [recordLabel]="labels().record" [peers]="peers()" />
  </hrs-layout>`,
})
export class PeersSection {
  /** From the route's data. */
  readonly side = input.required<PeersSide>();
  private readonly store = inject(PlayerPageStore);
  private readonly all = computed(() => playerPeers(this.store.games()));
  protected readonly peers = computed(() => this.all()[this.side()]);
  protected readonly labels = computed(() => LABELS[this.side()]);
}
