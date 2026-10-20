import { Component, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { LightKind } from '../../../scenes/play-background/scene-lights';
import { PropertySection } from '../properties/property-section';
import { LIGHT_ICONS } from './editor-model';

/** A light of each kind there is, as offered to add. */
const KINDS: readonly { readonly kind: LightKind; readonly label: string }[] = [
  { kind: 'ambient', label: 'Ambient' },
  { kind: 'directional', label: 'Directional' },
  { kind: 'shadow', label: 'Antilight' },
];

/**
 * A section to add a light (presentational): one button for each kind of light (from all round,
 * from a side, or darkening from a side), to what is selected (a body, the scene).
 */
@Component({
  selector: 'hrs-add-light',
  imports: [MatIcon, PropertySection],
  templateUrl: './add-light.html',
  styleUrl: './properties-panel.scss',
})
export class AddLight {
  readonly added = output<LightKind>();
  protected readonly kinds = KINDS;
  protected readonly icons = LIGHT_ICONS;
}
