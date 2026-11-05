import { booleanAttribute, Component, contentChild, Directive, inject, input, TemplateRef } from '@angular/core';

/** What a cell's template gets: the row's item, and where it is among all of them. */
export interface CellContext<T> {
  readonly $implicit: T;
  readonly index: number;
}

/** How a column's cells are drawn (`<ng-template hrsCell let-item>`); without one, the item's field of the column's name. */
@Directive({ selector: 'ng-template[hrsCell]' })
export class CellTemplate<T> {
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: CellTemplate<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a type guard names what it guards
    _ctx: unknown,
  ): _ctx is CellContext<T> {
    return true;
  }
}

/** How a column's header is drawn (`<ng-template hrsHeader>`); without one, its `header`. */
@Directive({ selector: 'ng-template[hrsHeader]' })
export class HeaderTemplate {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/**
 * A column of a data grid, declared inside it: `<hrs-column name="kills" header="Kills"
 * width="6ch" align="end" sortable />`, with `hrsCell` and `hrsHeader` templates for anything
 * beyond plain text. It draws nothing itself.
 */
@Component({
  selector: 'hrs-column',
  template: '',
  host: { style: 'display: none' },
})
export class GridColumn {
  /** The column's key: what the grid sorts by, and the item's field shown without a cell template. */
  readonly name = input.required<string>();
  /** The header's text (and its name for a header template that draws an icon). */
  readonly header = input('');
  /** Its grid track: `6ch`, `minmax(12em, 2fr)`, `max-content`; `auto` fits the widest cell drawn. */
  readonly width = input('auto');
  /** `end` for figures: right-aligned, tabular numbers. */
  readonly align = input<'start' | 'end'>('start');
  readonly sortable = input(false, { transform: booleanAttribute });
  /** Its cells name their rows (`rowheader`); without one marked, the first column's do. */
  readonly rowHeader = input(false, { transform: booleanAttribute });
  /** The direction its first press sorts in, when not the grid's. */
  readonly sortStart = input<'asc' | 'desc' | undefined>(undefined);
  /** Classes on its header and cells, for the page's own styles. */
  readonly cellClass = input('');

  readonly cell = contentChild(CellTemplate);
  readonly headerTemplate = contentChild(HeaderTemplate);
}
