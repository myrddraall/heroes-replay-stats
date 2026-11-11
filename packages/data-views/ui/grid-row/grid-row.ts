import {
  Component,
  DestroyRef,
  Directive,
  inject,
  Injector,
  input,
  signal,
  type Signal,
  TemplateRef,
} from '@angular/core';

/** The height a grid's rows are, in px, as the grid measured it: what its rows give their cells. */
export abstract class GridRowHeight {
  abstract readonly rowHeight: Signal<number>;
}

/**
 * One row of a data grid, the grid's own row element (`hrs-data-grid` draws one per item): a plain
 * container, the row's cells its children, lined up with the columns. It carries the row's place,
 * item and theme, marks every other row (`hrs-grid__row--alternate`), takes the classes a row look
 * gives it, and tells the cells and the row look inside it where they are (inject `GridRow`).
 */
@Directive({
  selector: '[hrsGridRow]',
  exportAs: 'hrsGridRow',
  host: {
    role: 'row',
    '[attr.theme]': 'theme()',
    '[class]': 'looks()',
    '[class.hrs-grid__row--alternate]': 'index() % 2 === 1',
  },
})
export class GridRow {
  /** The row's place among the grid's items. */
  readonly index = input.required<number>();
  /** Its item; null while a source loads it. */
  readonly item = input<unknown>(null);
  /** Its theme (a team's, or the user's own: `blue-self`, `red-self`); null for the one around it. */
  readonly theme = input<string | null>(null);
  /** The grid's row height, px. */
  readonly height = inject(GridRowHeight).rowHeight;
  /** For the cells and the row look drawn inside it from templates (declared elsewhere). */
  readonly injector = inject(Injector);

  protected readonly looks = signal<readonly string[]>([]);

  /** A row look's classes on the row (the theme's `hrs-grid__row`, say), until the look goes. */
  addClass(name: string): void {
    this.looks.update((classes) => [...classes, name]);
  }

  removeClass(name: string): void {
    this.looks.update((classes) => classes.filter((c) => c !== name));
  }
}

/**
 * The grid's rows' look (`<hrs-grid-row *hrsRow />`, `<ui-score-row *hrsRow />`): drawn inside
 * every row, beside its cells, injecting `GridRow` for the row it is in. Without one, a row is a
 * plain container.
 */
@Directive({ selector: 'ng-template[hrsRow]' })
export class RowTemplate {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/**
 * The theme's row look (`<hrs-grid-row *hrsRow />`): the row and its cells as the theme draws a
 * table's (the DataGrid spec's `hrs-grid__row`: lines, hover, a team's film). Draws nothing itself.
 */
@Component({
  selector: 'hrs-grid-row',
  template: '',
  host: { style: 'display: none' },
})
export class GridRowElement {
  constructor() {
    const row = inject(GridRow);
    row.addClass('hrs-grid__row');
    inject(DestroyRef).onDestroy(() => row.removeClass('hrs-grid__row'));
  }
}
