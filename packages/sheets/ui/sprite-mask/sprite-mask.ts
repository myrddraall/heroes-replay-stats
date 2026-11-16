import { computed, Directive, effect, inject, input, signal, untracked } from '@angular/core';
import { parseSheetName, SHEET_PICTURES } from '../../model';

/**
 * Clips its element to a sheet's picture (`hrsSpriteMask="profile#hero-frame"`): the picture is
 * its mask, stretched over the element, so what the element draws (its background colour, a
 * theme's) shows in the picture's shape. A tint for art made to be coloured. Until the picture
 * has loaded, the element shows nothing (a mask that hides all of it), never its plain box.
 */
@Directive({
  selector: '[hrsSpriteMask]',
  host: {
    '[style.mask-image]': 'image()',
    '[style.mask-size]': "'100% 100%'",
    '[style.mask-repeat]': "'no-repeat'",
  },
})
export class SpriteMask {
  /** A sheet's picture by name (`sheet#picture`). */
  readonly hrsSpriteMask = input.required<string>();

  private readonly store = inject(SHEET_PICTURES);
  private readonly cut = signal<string | null>(null);
  /** The picture as the mask, or, until it has been cut, one that hides the whole element. */
  protected readonly image = computed(() =>
    this.cut() ? `url("${this.cut()}")` : 'linear-gradient(transparent, transparent)',
  );

  constructor() {
    // the picture's sheet, then the picture cut out of it as a file of its own (a mask can't take
    // a place in a sheet), cut once and shared
    effect((onCleanup) => {
      const { sheet, entry } = parseSheetName(this.hrsSpriteMask());
      const url = this.store.sheetUrl(sheet);
      untracked(() => this.store.load(url));
      const status = this.store.status(url);
      if (status?.status !== 'ready') return;
      const rect = status.picture.meta?.pictures?.[entry];
      if (!rect) return;
      let current = true;
      onCleanup(() => (current = false));
      void this.store.piece(url, { rect }).then((piece) => {
        if (current) this.cut.set(piece);
      });
    });
  }
}
