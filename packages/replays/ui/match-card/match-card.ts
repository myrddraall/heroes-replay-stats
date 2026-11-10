import { Component, computed, input } from '@angular/core';
import type { Picture } from '@myrddraall/hero-data';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import type { ReplaySummary } from '../../model';
import { ReplayFacts } from '../replay-facts/replay-facts';
import { MODE_LABELS } from '../replay-list-item/replay-list-item';

/**
 * A match's card (presentational), at the top of its page's side panel: a panel (hrs-panel) with
 * the map's replay preview (`preview`, none where the data has none) across its top, the map's
 * name and the mode over the preview's foot, and the match's facts (when it was played, how long
 * it lasted, the game's build) under it.
 */
@Component({
  selector: 'hrs-match-card',
  imports: [ReplayFacts, Sprite],
  templateUrl: './match-card.html',
  styleUrl: './match-card.scss',
})
export class MatchCard {
  readonly replay = input.required<ReplaySummary>();
  /** The map's replay preview: a file, or its place in the sheet of every map's. */
  readonly preview = input<Picture | null>(null);

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
}
