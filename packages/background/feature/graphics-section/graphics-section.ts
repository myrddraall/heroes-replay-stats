import { Component, inject } from '@angular/core';
import { GraphicsForm } from '../../ui';
import { GraphicsSectionStore } from './graphics-section.store';

/** The Graphics section of the settings (container), added through `provideSettingsSection`. */
@Component({
  selector: 'hrs-graphics-section',
  imports: [GraphicsForm],
  templateUrl: './graphics-section.html',
  providers: [GraphicsSectionStore],
})
export class GraphicsSection {
  protected readonly store = inject(GraphicsSectionStore);
}
