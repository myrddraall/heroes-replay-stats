import { Component, input } from '@angular/core';
import type { TextureEntry } from '../materials/materials';

/** What the library says of one thing: facts, lists of names, the textures it reads. */
export interface AssetDetails {
  readonly kind: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly lists: readonly { readonly title: string; readonly items: readonly string[] }[];
  readonly textures: readonly TextureEntry[];
}

/** One thing of the library, as information only (presentational): no controls; it is opened to be set. */
@Component({
  selector: 'forge-asset-details',
  templateUrl: './asset-details.html',
  styleUrl: './asset-details.scss',
})
export class AssetDetailsView {
  readonly details = input.required<AssetDetails>();
  /** Where the game data is served (its textures linked under it). */
  readonly dataUrl = input.required<string>();
}
