import { Component, ElementRef, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { ShellSideNav } from '@myrddraall/heroes-replay-stats-shell/feature';
import { afterPageSettles, Showcase, ShowcaseRow, SideNavPage } from '../../ui';

/**
 * The game's standard tooltip, the UI area's Components › Tooltips › Standard tooltip
 * (`/ui/components/tooltips/standard`): every `matTooltip` in the app, the theme drawing it. One
 * shows when the page opens, so its look shows without hovering.
 */
@Component({
  selector: 'hrs-standard-tooltip-page',
  imports: [MatButton, MatTooltip, ShellSideNav, Showcase, ShowcaseRow, SideNavPage],
  templateUrl: './standard-tooltip-page.html',
  styleUrl: './standard-tooltip-page.scss',
})
export class StandardTooltipPage {
  /** The tooltip shown when the page opens, and its button. */
  private readonly shown = viewChild.required<MatTooltip>('shown');
  private readonly shownButton = viewChild.required('shownButton', { read: ElementRef<HTMLElement> });

  constructor() {
    afterPageSettles(
      () => this.shownButton().nativeElement,
      () => this.shown().show(0),
    );
  }
}
