import { Component, inject } from '@angular/core';
import { AddedList } from '../controls/added-list';
import { PickList } from '../controls/pick-list';
import { PropertySection } from '../controls/property-section';
import { DraftDesignStore } from '../draft/draft-design.store';
import { Editor } from '../editing/editor';
import { AddLight } from '../lights/add-light';
import { AddPart } from '../parts/add-part';
import { AddPlanet } from '../scene-editor/add-planet';

/**
 * One of the selected body's categories in the tree (container, on the `Editor` in effect): what
 * adds to it, and what is in it, each a way to it in the tree. Its shapes: parts added or reused,
 * or saved as an overlay; its lights; the overlays it wears; its moons.
 */
@Component({
  selector: 'forge-category-panel',
  imports: [AddedList, AddLight, AddPart, AddPlanet, PickList, PropertySection],
  templateUrl: './category-panel.html',
  styleUrl: './body-panel.scss',
})
export class CategoryPanel {
  protected readonly editor = inject(Editor);
  private readonly draft = inject(DraftDesignStore);

  /** A new overlay made (empty, named as it starts) and worn by the body. */
  protected newOverlay(): void {
    this.editor.addOverlay(this.draft.createOverlay('planet'));
  }
}
