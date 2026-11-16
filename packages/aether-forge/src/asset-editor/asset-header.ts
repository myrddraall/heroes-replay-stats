import { Component, inject } from '@angular/core';
import { AssetEditorStore } from './asset-editor.store';

/**
 * The asset editor's head (container, on its store): a material opened from a planet or overlay
 * is shown on that, or on the stand-in, as switched here.
 */
@Component({
  selector: 'forge-asset-header',
  templateUrl: './asset-header.html',
  styleUrl: './asset-header.scss',
})
export class AssetHeader {
  protected readonly store = inject(AssetEditorStore);
}
