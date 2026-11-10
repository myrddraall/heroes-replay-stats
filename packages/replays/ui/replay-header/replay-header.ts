import { Component, computed, input } from '@angular/core';
import type { ReplaySummary } from '../../model';
import { MODE_LABELS } from '../replay-list-item/replay-list-item';
import { ReplayFacts } from '../replay-facts/replay-facts';

/**
 * A replay's title and mode (presentational); on a handset, its facts under them too (elsewhere
 * the page puts them under its sections, in the shell's left-hand drawer).
 */
@Component({
  selector: 'hrs-replay-header',
  imports: [ReplayFacts],
  templateUrl: './replay-header.html',
  styleUrl: './replay-header.scss',
})
export class ReplayHeader {
  readonly replay = input.required<ReplaySummary>();

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
}
