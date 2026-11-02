import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { ReplaySummary } from '@myrddraall/heroes-replay-stats-replays/model';
import { formatDuration, MODE_LABELS } from '@myrddraall/heroes-replay-stats-replays/ui';

/** A replay's title, and when and how long it was played (presentational). */
@Component({
  selector: 'hrs-replay-header',
  imports: [DatePipe],
  templateUrl: './replay-header.html',
  styleUrl: './replay-header.scss',
})
export class ReplayHeader {
  readonly replay = input.required<ReplaySummary>();

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
  protected readonly duration = computed(() => formatDuration(this.replay().durationSeconds));
}
