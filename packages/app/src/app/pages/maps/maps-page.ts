import { Component, inject } from '@angular/core';
import { MapList } from './map-list';
import { MapsPageStore } from './maps-page.store';

/** The maps there are packs of (container): choose one to show it. */
@Component({
  selector: 'hrs-maps-page',
  imports: [MapList],
  templateUrl: './maps-page.html',
  providers: [MapsPageStore],
})
export class MapsPage {
  protected readonly store = inject(MapsPageStore);
}
