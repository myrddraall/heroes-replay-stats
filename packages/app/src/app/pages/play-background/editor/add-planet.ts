import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { GraphicsStore } from '../../../data/settings/graphics.store';
import { BARE } from '../../../scenes/play-background/planet-sets';
import { AssetCatalogStore } from './asset-catalog.store';
import { PickFlyout, type PickItem } from './pick-flyout';

const KINDS: Readonly<Record<string, string>> = {
  play: 'Play screen',
  world: 'Flyby world',
  painted: 'Painted',
};

/**
 * A button that puts a planet in a scene, as a planet of its own or a moon (container, on the
 * page's catalog): its flyout lists the planets there are, filtered; the one picked is given
 * (`picked`).
 */
@Component({
  selector: 'hrs-add-planet',
  imports: [MatIcon, CdkOverlayOrigin, CdkConnectedOverlay, PickFlyout],
  templateUrl: './add-planet.html',
  styleUrl: './add-planet.scss',
})
export class AddPlanet {
  /** What the button (and its flyout) says: 'Add planet', 'Add moon'. */
  readonly label = input('Add planet');
  readonly picked = output<string>();
  private readonly catalog = inject(AssetCatalogStore);
  protected readonly graphics = inject(GraphicsStore);
  protected readonly open = signal(false);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];
  protected readonly planets = computed((): PickItem[] =>
    this.catalog.planets().map((p) => ({
      id: p.id,
      label: p.id,
      caption: p.id.endsWith(BARE) ? 'Play screen, no shield' : KINDS[p.kind],
    })),
  );

  protected pick(id: string): void {
    this.open.set(false);
    this.picked.emit(id);
  }
}
