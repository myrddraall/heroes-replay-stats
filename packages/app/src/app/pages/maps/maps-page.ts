import { Component, inject } from '@angular/core';
import { MapList } from './map-list';
import { MapsPageStore } from './maps-page.store';
import { Layout } from '../../layout/layout';

/** The maps there are packs of (container): choose one to show it. */
@Component({
  selector: 'hrs-maps-page',
  imports: [Layout, MapList],
  templateUrl: './maps-page.html',
  providers: [MapsPageStore],
})
export class MapsPage {
  protected readonly store = inject(MapsPageStore);
}
