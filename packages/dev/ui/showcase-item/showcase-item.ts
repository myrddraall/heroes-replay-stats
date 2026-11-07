import { Component, input } from '@angular/core';

/** One thing in a showcase row, its caption under it (its state, its size). */
@Component({
  selector: 'hrs-showcase-item',
  templateUrl: './showcase-item.html',
  styleUrl: './showcase-item.scss',
})
export class ShowcaseItem {
  readonly caption = input.required<string>();
}
