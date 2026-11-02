import { Component, computed, effect, inject, untracked } from '@angular/core';
import { NineSlice, type SliceSource } from '../../nine-slice/nine-slice';
import type { SliceOptions } from '../../nine-slice/slice-frame';
import { SheetStore } from '../../sheet/sheet.store';

/** The sheet the preview draws its frames from: heroes-assets' validation sheet (game frames). */
const SHEET = 'validation';

/**
 * The 9-slice frames in preview, from the validation sheet: a set (a panel behind and a game Border in
 * front) on panels of two shapes, a button with its states, a game Border (parts placed, side
 * edges turned), the border tinted in the teams' colours, the back's repeat modes side by side, a
 * mirrored button and the debug outline. The variants are the sheet's frames with options of their
 * own, made here from the sheet's metadata.
 */
@Component({
  selector: 'hrs-theme-preview-frames',
  imports: [NineSlice],
  templateUrl: './theme-preview-frames.html',
  styleUrl: './theme-preview-frames.scss',
})
export class ThemePreviewFrames {
  private readonly store = inject(SheetStore);
  private readonly url = this.store.sheetUrl(SHEET);
  protected readonly status = computed(() => this.store.status(this.url));

  /** A sheet frame with other options, as a frame object. */
  protected variant(frame: string, options: SliceOptions): SliceSource | undefined {
    const status = this.status();
    if (status?.status !== 'ready') return undefined;
    const found = status.picture.meta?.frames[frame];
    if (!found) return undefined;
    return {
      picture: { src: this.url },
      states: found.states,
      cuts: found.cuts,
      parts: found.parts,
      ...(found as SliceOptions),
      ...options,
    };
  }

  protected readonly tinted = computed(() =>
    this.variant('terran-tech', { tint: 'rgb(var(--hrs-glass-edge))' }),
  );
  protected readonly stretched = computed(() =>
    this.variant('context-menu', { edges: 'stretch', centre: 'stretch' }),
  );
  protected readonly tiled = computed(() => this.variant('context-menu', { edges: 'tile', centre: 'tile', tile: 40 }));
  protected readonly rounded = computed(() =>
    this.variant('context-menu', { edges: 'round', centre: 'round', tile: 40 }),
  );
  protected readonly mirrored = computed(() => this.variant('topnav-button', { mirror: 'x' }));
  protected readonly debug = computed(() => this.variant('terran-tech', { debug: true, scale: 0.5 }));

  constructor() {
    effect(() => untracked(() => this.store.load(this.url)));
  }
}
