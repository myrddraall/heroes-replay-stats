import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { Component, inject, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { GraphicsStore } from '../../../data/settings/graphics.store';
import { PickFlyout, type PickItem } from './pick-flyout';

/**
 * A button that puts a group in a scene (or in another group) (presentational): its flyout lists
 * the groups that may be put there (`groups`), filtered; the one picked is given (`picked`).
 */
@Component({
  selector: 'hrs-add-group',
  imports: [MatIcon, CdkOverlayOrigin, CdkConnectedOverlay, PickFlyout],
  templateUrl: './add-group.html',
  styleUrl: './add-planet.scss',
})
export class AddGroup {
  readonly groups = input.required<readonly PickItem[]>();
  readonly picked = output<string>();
  protected readonly graphics = inject(GraphicsStore);
  protected readonly open = signal(false);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];

  protected pick(id: string): void {
    this.open.set(false);
    this.picked.emit(id);
  }
}
