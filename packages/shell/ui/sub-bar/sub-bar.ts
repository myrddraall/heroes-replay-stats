import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ShellNavEntry } from '../../model';

/** Level 2 of the shell (presentational; the theme's SubBar): the sections as a tab row. */
@Component({
  selector: 'hrs-sub-bar',
  imports: [RouterLink],
  template: `<nav class="hrs-subbar" [attr.aria-label]="label()">
    <div class="hrs-subbar__scroll">
      @for (section of sections(); track section.link) {
        <a class="hrs-tab" [routerLink]="section.link" [attr.aria-current]="section.active ? 'page' : null">{{
          section.label
        }}</a>
      }
    </div>
  </nav>`,
  styles: `
    :host {
      display: block;
      position: relative;
      z-index: 2;
    }
  `,
})
export class SubBar {
  readonly sections = input.required<readonly ShellNavEntry[]>();
  /** What the sections are, for screen readers. */
  readonly label = input('Sections');
}
