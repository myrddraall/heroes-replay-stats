import { Component, computed, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import { MapViewer } from '@myrddraall/heroes-replay-stats-map';
import { SidePanel } from '@myrddraall/heroes-replay-stats-ui';
import { MapExploreStore, type PanelMode, type PanelPosition } from './map-explore.store';
import { MapFacts } from './map-facts';
import { MapViewControls } from './map-view-controls';
import { PoiDetails } from './poi-details';
import { PoiList } from './poi-list';

/**
 * The map in explore mode (container): the viewer, with the points of interest to pick, between
 * two side panels (Material drawers, configurable): the map's information on one side, the pick's
 * facts and the list of points of interest on the other.
 */
@Component({
  selector: 'hrs-map-explore',
  imports: [
    MatDrawerContainer,
    MatDrawer,
    MatDrawerContent,
    MatIconButton,
    MatIcon,
    MapViewer,
    SidePanel,
    PoiDetails,
    PoiList,
    MapFacts,
    MapViewControls,
  ],
  templateUrl: './map-explore.html',
  styleUrl: './map-explore.scss',
  providers: [MapExploreStore],
})
export class MapExplore {
  /** heroes-maps' id of the map. */
  readonly mapId = input.required<string>();
  /** Which side the details panel is on; the information panel takes the other. */
  readonly panelPosition = input<PanelPosition>('end');
  /** How the panels sit against the map: beside it, over it, or pushing it. */
  readonly panelMode = input<PanelMode>('side');
  /** Open or closed; left out, open except on a handset. */
  readonly detailsOpened = input<boolean | undefined>(undefined);
  readonly infoOpened = input<boolean | undefined>(undefined);

  protected readonly store = inject(MapExploreStore);

  constructor() {
    this.store.load(this.mapId);
    this.store.configurePanels(
      computed(() => ({
        position: this.panelPosition(),
        mode: this.panelMode(),
        detailsOpened: this.detailsOpened(),
        infoOpened: this.infoOpened(),
      })),
    );
  }

  /** The toggle's icon: a panel on the start side opens leftwards, on the end side rightwards. */
  protected toggleIcon(position: PanelPosition, opened: boolean): string {
    return `${position === 'start' ? 'left' : 'right'}_panel_${opened ? 'close' : 'open'}`;
  }
}
