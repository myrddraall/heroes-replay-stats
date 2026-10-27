import { Component, input, output } from '@angular/core';
import { PropertySection } from '../controls/property-section';
import { PropertyCheck } from '../controls/rows/property-check';
import type { OverlayView } from './overlays';

/**
 * An overlay a body wears, as its properties show it (presentational): whether it is drawn, a way
 * to open it in the library (where its parts and settings are), and to take it off the body.
 */
@Component({
  selector: 'forge-overlay-properties',
  imports: [PropertySection, PropertyCheck],
  templateUrl: './overlay-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class OverlayProperties {
  readonly overlay = input.required<OverlayView>();
  readonly enabledChange = output<boolean>();
  readonly openRequested = output<void>();
  readonly takeOffRequested = output<void>();
}
