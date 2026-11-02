import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '../../../layout/layout';
import { EmptyState } from '../../empty-state';
import { ReplayPageStore } from '../replay-page.store';
import { ScoreScreen } from './score-screen';

/** The replay's score screen (container), from its page's store. */
@Component({
  selector: 'hrs-score-section',
  imports: [EmptyState, Layout, MatProgressBar, ScoreScreen],
  templateUrl: './score-section.html',
})
export class ScoreSection {
  protected readonly store = inject(ReplayPageStore);
}
