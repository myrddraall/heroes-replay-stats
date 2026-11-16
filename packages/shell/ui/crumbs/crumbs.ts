import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ShellNavEntry } from '../../model';

/**
 * Where the page shown is, as links back up (presentational; the theme's breadcrumb, shown in the
 * SubBar's band on a handset): area › page › section, the last one current.
 */
@Component({
  selector: 'hrs-crumbs',
  imports: [RouterLink],
  template: `<nav aria-label="Breadcrumb">
    <ol class="hrs-crumbs">
      @for (crumb of crumbs(); track crumb.link; let last = $last) {
        <li>
          @if (last) {
            <span aria-current="page">{{ crumb.label }}</span>
          } @else {
            <a [routerLink]="crumb.link">{{ crumb.label }}</a>
          }
        </li>
      }
    </ol>
  </nav>`,
  styles: `
    :host {
      display: block;
      position: relative;
      z-index: 2;
    }
  `,
})
export class Crumbs {
  readonly crumbs = input.required<readonly ShellNavEntry[]>();
}
