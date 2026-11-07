import { Component, input } from '@angular/core';

/** A row of a showcase: its label, then what it shows (`hrs-showcase-item`s or the things themselves). */
@Component({
  selector: 'hrs-showcase-row',
  templateUrl: './showcase-row.html',
  styleUrl: './showcase-row.scss',
})
export class ShowcaseRow {
  readonly label = input.required<string>();
}
