import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { DraftList } from './draft-list';
import { DraftSectionStore } from './draft-section.store';

/** The replay's draft (container): `/replays/<id>/draft`. */
@Component({
  selector: 'hrs-draft-section',
  imports: [DraftList, EmptyState, Layout, MatProgressBar],
  templateUrl: './draft-section.html',
  providers: [DraftSectionStore],
})
export class DraftSection {
  protected readonly store = inject(DraftSectionStore);
}
