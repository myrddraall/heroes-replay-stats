import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { TalentTable } from './talent-table';
import { TalentsSectionStore } from './talents-section.store';

/** The replay's talents (container): `/replays/<id>/talents`. */
@Component({
  selector: 'hrs-talents-section',
  imports: [Layout, MatProgressBar, TalentTable],
  templateUrl: './talents-section.html',
  providers: [TalentsSectionStore],
})
export class TalentsSection {
  protected readonly store = inject(TalentsSectionStore);
}
