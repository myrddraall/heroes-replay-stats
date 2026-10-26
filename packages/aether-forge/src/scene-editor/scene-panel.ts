import { Component, inject } from '@angular/core';
import { AddedList } from '../controls/added-list';
import { PropertySection } from '../controls/property-section';
import { DraftDesignStore } from '../draft/draft-design.store';
import { Editor } from '../editing/editor';
import { AddCamera } from '../properties/camera/add-camera';
import { CameraProperties } from '../properties/camera/camera-properties';
import { AddLight } from '../properties/light/add-light';
import { VariantList } from '../variants/variant-list';
import { AddPlanet } from './add-planet';
import { GroupPlacementProperties } from './group-placement-properties';
import { SceneEditorStore } from './scene-editor.store';
import { SceneProperties } from './scene-properties';

/**
 * The scene's own properties in the selection panel (container, on the scene editor's store): the
 * scene's (its name, tint, planets, variants, cameras, lights), a group placed in it, its cameras,
 * one camera.
 */
@Component({
  selector: 'forge-scene-panel',
  imports: [
    AddCamera,
    AddedList,
    AddLight,
    AddPlanet,
    CameraProperties,
    GroupPlacementProperties,
    PropertySection,
    SceneProperties,
    VariantList,
  ],
  templateUrl: './scene-panel.html',
  styleUrl: './scene-panel.scss',
})
export class ScenePanel {
  protected readonly editor = inject(Editor);
  protected readonly scene = inject(SceneEditorStore);
  protected readonly draft = inject(DraftDesignStore);
}
