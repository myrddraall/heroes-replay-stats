import { Component, inject, Injector, input, type Signal } from '@angular/core';

/** The height a grid's rows are, in px, as the grid measured it: what its rows give their cells. */
export abstract class GridRowHeight {
  abstract readonly rowHeight: Signal<number>;
}

/**
 * One row of a data grid, which the grid draws for each item (`hrs-data-grid`): it carries the
 * row's theme, sizes its type from the grid's row height (`--hrs-grid-row-height` times
 * `--hrs-grid-row-type-scale`, when the page sets the scale), marks every other row
 * (`hrs-grid__row--alternate`, by its place, so it holds however many are drawn) and tells the cells
 * inside it where it is (inject `GridRow`).
 */
@Component({
  selector: 'hrs-grid-row',
  template: '<ng-content />',
  styleUrl: './grid-row.scss',
  host: {
    class: 'hrs-grid__row',
    role: 'row',
    '[attr.theme]': 'theme()',
    '[class.hrs-grid__row--alternate]': 'index() % 2 === 1',
  },
})
export class GridRow {
  /** The row's place among the grid's items. */
  readonly index = input.required<number>();
  /** Its theme (a team's, or the user's own: `blue-self`, `red-self`); null for the one around it. */
  readonly theme = input<string | null>(null);
  /** The grid's row height, px. */
  readonly height = inject(GridRowHeight).rowHeight;
  /** For the cells drawn inside it from the columns' templates (declared elsewhere). */
  readonly injector = inject(Injector);
}
