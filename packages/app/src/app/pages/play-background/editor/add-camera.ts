import { Component, output } from '@angular/core';
import { SplitButton, type SplitOption } from './split-button';

/** The button to add a camera to the scene (presentational): one where the view looks from; in the section of its cameras. */
@Component({
  selector: 'hrs-add-camera',
  imports: [SplitButton],
  templateUrl: './add-camera.html',
  styleUrl: './properties-panel.scss',
})
export class AddCamera {
  readonly added = output<void>();
  protected readonly options: readonly SplitOption[] = [
    { id: 'view', label: 'From the view', icon: 'videocam' },
  ];
}
