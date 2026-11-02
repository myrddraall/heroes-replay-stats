import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { ReplayPageStore } from '../replay-page';
import { ScoreScreen } from '../../ui';

/** The replay's score screen (container), from its page's store. */
@Component({
  selector: 'hrs-score-section',
  imports: [EmptyState, Layout, MatProgressBar, ScoreScreen],
  templateUrl: './score-section.html',
})
export class ScoreSection {
  protected readonly store = inject(ReplayPageStore);
}
