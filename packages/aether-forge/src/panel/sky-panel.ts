import { Component, inject } from '@angular/core';
import { AddedList } from '../controls/added-list';
import { PickList } from '../controls/pick-list';
import { PropertySection } from '../controls/property-section';
import { type PropertyOption, PropertySelect } from '../controls/rows/property-select';
import { DraftDesignStore } from '../draft/draft-design.store';
import { Editor } from '../editing/editor';
import { SKY_ANCHOR_CHOICES } from '../sky/sky';
import { AddPart } from '../parts/add-part';

/**
 * A sky's properties in the selection panel (container, on the `Editor` in effect): a tint over all
 * of it, its anchor, the overlays it wears, the parts added onto it.
 */
@Component({
  selector: 'forge-sky-panel',
  imports: [AddedList, AddPart, PickList, PropertySection, PropertySelect],
  templateUrl: './sky-panel.html',
  styleUrl: './sky-panel.scss',
})
export class SkyPanel {
  protected readonly editor = inject(Editor);
  private readonly draft = inject(DraftDesignStore);
  /** The anchors a sky may be given. */
  protected readonly skyAnchors: readonly PropertyOption[] = SKY_ANCHOR_CHOICES;

  /** The sky's anchor chosen (one of those there are). */
  protected setSkyAnchor(value: string): void {
    const found = SKY_ANCHOR_CHOICES.find((o) => o.value === value);
    if (found) this.editor.setSkyAnchor(found.value);
  }

  /** A new overlay made (empty, named as it starts) and worn by the sky. */
  protected newOverlay(): void {
    this.editor.addSkyOverlay(this.draft.createOverlay('sky'));
  }
}
