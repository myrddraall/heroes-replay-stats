import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { ReplaySummary } from '../../model';
import { formatDuration } from '../replay-list-item/replay-list-item';

/** When a match was played, how long it lasted and the game's build (presentational), as named lines. */
@Component({
  selector: 'hrs-replay-facts',
  imports: [DatePipe],
  templateUrl: './replay-facts.html',
  styleUrl: './replay-facts.scss',
})
export class ReplayFacts {
  readonly replay = input.required<ReplaySummary>();
  protected readonly duration = computed(() => formatDuration(this.replay().durationSeconds));
}
