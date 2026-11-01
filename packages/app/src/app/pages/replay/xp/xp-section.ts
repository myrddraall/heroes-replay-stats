import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '../../../layout/layout';
import { XpSectionStore } from './xp-section.store';
import { XpTables } from './xp-tables';

/** The replay's XP by team (container): `/replays/<id>/xp`. */
@Component({
  selector: 'hrs-xp-section',
  imports: [Layout, MatProgressBar, XpTables],
  templateUrl: './xp-section.html',
  providers: [XpSectionStore],
})
export class XpSection {
  protected readonly store = inject(XpSectionStore);
}
