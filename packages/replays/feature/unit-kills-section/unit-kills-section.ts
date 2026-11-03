import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { UnitKillTables } from '../../ui';
import { UnitKillsSectionStore } from './unit-kills-section.store';

/** The replay's unit kills (container): `/matches/<id>/unit-kills`. */
@Component({
  selector: 'hrs-unit-kills-section',
  imports: [Layout, MatProgressBar, UnitKillTables],
  templateUrl: './unit-kills-section.html',
  providers: [UnitKillsSectionStore],
})
export class UnitKillsSection {
  protected readonly store = inject(UnitKillsSectionStore);
}
