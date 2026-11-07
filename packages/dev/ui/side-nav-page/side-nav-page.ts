import { Component } from '@angular/core';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';

/**
 * A page beside its section's side nav (level 3), edge to edge, the page laying itself out:
 * `<hrs-side-nav-page><hrs-shell-side-nav sideNav />…</hrs-side-nav-page>`. The side nav comes in
 * as content (the shell's), so this stays presentational.
 */
@Component({
  selector: 'hrs-side-nav-page',
  imports: [Layout, LayoutItem],
  templateUrl: './side-nav-page.html',
  styleUrl: './side-nav-page.scss',
})
export class SideNavPage {}
