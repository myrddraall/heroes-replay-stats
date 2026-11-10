import { Component, input } from '@angular/core';

/**
 * A component shown in the UI area (presentational): its name as the page's heading, what it is
 * (`<ng-container ngProjectAs="[about]">…</ng-container>`), then its rows (`hrs-showcase-row`).
 */
@Component({
  selector: 'hrs-showcase',
  templateUrl: './showcase.html',
  styleUrl: './showcase.scss',
})
export class Showcase {
  readonly heading = input.required<string>();
}
