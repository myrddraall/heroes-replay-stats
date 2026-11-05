import { Component, inject } from '@angular/core';
import { ShellNavStore } from '../../data';
import { SideNav } from '../../ui';

/**
 * The page's level-3 navigation (smart), placed by the page in its own layout: the sections under
 * the level-2 section shown, as the SideNav column; nothing where there are none. On a handset the
 * nav drawer's tree holds them instead.
 */
@Component({
  selector: 'hrs-shell-side-nav',
  imports: [SideNav],
  template: `@let nav = store.nav();
    @if (nav.level3Of; as of) {
      <hrs-side-nav [title]="of.label" [sections]="nav.level3" />
    }`,
  // the column itself is the layout's item (and sticks within it), inside the layout's padding
  styles: `
    hrs-side-nav {
      margin-inline-start: var(--hrs-layout-padding, 0px);
    }
  `,
  host: { '[style.display]': "store.nav().level3Of ? 'contents' : 'none'" },
})
export class ShellSideNav {
  protected readonly store = inject(ShellNavStore);
}
