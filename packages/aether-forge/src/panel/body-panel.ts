import { Component, inject } from '@angular/core';
import { Editor } from '../editing/editor';
import { BodyProperties } from '../bodies/body-properties';
import { LitBy } from '../lights/lit-by';
import { PanelPagesStore } from './panel-pages.store';

/**
 * The selected body's properties (container, on the `Editor` in effect), and what lights it. What
 * it wears, its parts, lights and moons are added from its categories in the tree.
 */
@Component({
  selector: 'forge-body-panel',
  imports: [BodyProperties, LitBy],
  templateUrl: './body-panel.html',
  styleUrl: './body-panel.scss',
})
export class BodyPanel {
  protected readonly editor = inject(Editor);
  protected readonly pages = inject(PanelPagesStore);
}
