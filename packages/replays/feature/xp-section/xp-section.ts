import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { XpSectionStore } from './xp-section.store';
import { XpTables } from '../../ui';

/** The replay's XP over time by team (container): `/replays/matches/<id>/teams/xp-over-time`. */
@Component({
  selector: 'hrs-xp-section',
  imports: [Layout, MatProgressBar, XpTables],
  templateUrl: './xp-section.html',
  providers: [XpSectionStore],
})
export class XpSection {
  protected readonly store = inject(XpSectionStore);
}
