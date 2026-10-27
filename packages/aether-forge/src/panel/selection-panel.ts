import { Component, inject } from '@angular/core';
import { PickList } from '../controls/pick-list';
import { PropertySelect } from '../controls/rows/property-select';
import { AidsPanel } from '../aids/aids-panel';
import { Editor } from '../editing/editor';
import { LightProperties } from '../lights/light-properties';
import { LitBy } from '../lights/lit-by';
import { PartProperties } from '../parts/part-properties';
import { ScenePanel } from '../scene-editor/scene-panel';
import { BodyPanel } from './body-panel';
import { MaterialPanel } from './material-panel';
import { SkyPanel } from './sky-panel';

/**
 * The properties of what is selected in the tree (container, on the `Editor` in effect: the scene
 * editor's or the asset editor's): which level edits land in, then the properties of the kind of
 * thing selected, each kind's panel its own (the scene's, a sky's, a body's, a material's, the
 * editing aids'), what they change going back to the editor, which writes it to the layer it edits.
 */
@Component({
  selector: 'forge-selection-panel',
  imports: [
    AidsPanel,
    BodyPanel,
    LightProperties,
    LitBy,
    MaterialPanel,
    PartProperties,
    PickList,
    PropertySelect,
    ScenePanel,
    SkyPanel,
  ],
  templateUrl: './selection-panel.html',
  styleUrl: './selection-panel.scss',
})
export class SelectionPanel {
  protected readonly editor = inject(Editor);
}
