import { Component, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PropertySection } from '../properties/property-section';

/** A section to add a camera to the scene (presentational): one where the view looks from. */
@Component({
  selector: 'hrs-add-camera',
  imports: [MatIcon, PropertySection],
  templateUrl: './add-camera.html',
  styleUrl: './properties-panel.scss',
})
export class AddCamera {
  readonly added = output<void>();
}
