import { Component, computed, effect, inject, untracked } from '@angular/core';
import { SHEET_PICTURES, type SliceOptions } from '@myrddraall/heroes-replay-stats-sheets/model';
import { NineSlice, Sprite, type SliceSource } from '@myrddraall/heroes-replay-stats-sheets/ui';

/** The sheet the preview draws its frames from: heroes-assets' validation sheet (game frames). */
const SHEET = 'validation';

/**
 * The 9-slice frames in preview, from the validation sheet: a set (a panel behind and the score
 * screen's frame in front) on panels of two shapes, a button with its states at the art's own
 * size, a game Border (parts placed, side edges turned) and its edges in each repeat mode, the
 * score screen's frame tinted in the teams' colours, the debug outline, and pictures from the same
 * sheet by name. The variants are the sheet's frames with options of their own, made here from the
 * sheet's metadata.
 */
@Component({
  selector: 'hrs-theme-preview-frames',
  imports: [NineSlice, Sprite],
  templateUrl: './theme-preview-frames.html',
  styleUrl: './theme-preview-frames.scss',
})
export class ThemePreviewFrames {
  private readonly store = inject(SHEET_PICTURES);
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
    this.variant('scorescreen-frame', { tint: 'var(--mat-sys-primary)' }),
  );
  protected readonly stretched = computed(() => this.variant('terran-tech', { edges: 'stretch' }));
  protected readonly tiled = computed(() => this.variant('terran-tech', { edges: 'tile' }));
  protected readonly rounded = computed(() => this.variant('terran-tech', { edges: 'round' }));
  protected readonly debug = computed(() => this.variant('terran-tech', { debug: true, scale: 0.5 }));

  constructor() {
    effect(() => untracked(() => this.store.load(this.url)));
  }
}
