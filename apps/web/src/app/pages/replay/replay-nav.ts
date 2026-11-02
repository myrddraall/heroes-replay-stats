import { Component, computed, input, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { ReplaySummary } from '@myrddraall/heroes-replay-stats-replays/model';
import { MODE_LABELS } from '@myrddraall/heroes-replay-stats-replays/ui';
import type { ReplayPageGroup } from './replay-pages';

/**
 * The open replay's pages, for the main nav under Replays (presentational): which replay, then
 * each category of pages, collapsible, listing its pages.
 */
@Component({
  selector: 'hrs-replay-nav',
  imports: [MatIcon, RouterLink, RouterLinkActive],
  templateUrl: './replay-nav.html',
  styleUrl: './replay-nav.scss',
})
export class ReplayNav {
  readonly replay = input.required<ReplaySummary>();
  readonly groups = input.required<readonly ReplayPageGroup[]>();

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
  /** The categories folded away, by title. */
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected toggle(title: string): void {
    this.collapsed.update((collapsed) => {
      const next = new Set(collapsed);
      if (!next.delete(title)) next.add(title);
      return next;
    });
  }

  protected link(path: string): string {
    return `/replays/${this.replay().id}/${path}`;
  }
}
