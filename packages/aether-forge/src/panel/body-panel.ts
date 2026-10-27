import { Component, inject } from '@angular/core';
import { AddedList } from '../controls/added-list';
import { PropertySection } from '../controls/property-section';
import { DraftDesignStore } from '../draft/draft-design.store';
import { Editor } from '../editing/editor';
import { BodyProperties } from '../bodies/body-properties';
import { AddLight } from '../lights/add-light';
import { LitBy } from '../lights/lit-by';
import { AddPart } from '../parts/add-part';
import { AddPlanet } from '../scene-editor/add-planet';

/**
 * A body's properties in the selection panel (container, on the `Editor` in effect): its own, its
 * moons and lights, its variants, the parts added onto it.
 */
@Component({
  selector: 'forge-body-panel',
  imports: [AddedList, AddLight, AddPart, AddPlanet, BodyProperties, LitBy, PropertySection],
  templateUrl: './body-panel.html',
  styleUrl: './body-panel.scss',
})
export class BodyPanel {
  protected readonly editor = inject(Editor);
  private readonly draft = inject(DraftDesignStore);

  /** A new overlay made (empty, named as it starts) and worn by the body. */
  protected newOverlay(): void {
    this.editor.addOverlay(this.draft.createOverlay('planet'));
  }
}
