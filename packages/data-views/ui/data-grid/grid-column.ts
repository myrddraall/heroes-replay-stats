import {
  booleanAttribute,
  Component,
  type ModelSignal,
  computed,
  contentChild,
  Directive,
  inject,
  input,
  type Signal,
  TemplateRef,
} from '@angular/core';
import type { GridSort } from '../../model';

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

/** How a column's header is drawn by a header that draws column templates (`<ng-template hrsHeader>`); without one, its `header`. */
@Directive({ selector: 'ng-template[hrsHeader]' })
export class HeaderTemplate {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/**
 * A column of a data grid, as the grid and the parts attached to it (a header, a column setup)
 * see it. `hrs-column` is one; a column kind (a component standing for a kind of column) is one
 * by providing itself as this, so the grid finds it among its content:
 * `providers: [{ provide: DataGridColumn, useExisting: StatColumn }]`.
 */
export abstract class DataGridColumn {
  /** Its key: what the grid sorts by, shows and hides it by, and the item's field it shows without a cell template. */
  abstract readonly name: Signal<string>;
  /** What it is, in words: its header's text, and its name to a header that draws something else. */
  abstract readonly header: Signal<string>;
  /** Its grid track: `6ch`, `minmax(12em, 2fr)`, `max-content`; `auto` fits the widest cell drawn. */
  abstract readonly width: Signal<string>;
  /** `end` for figures: right-aligned, tabular numbers. */
  abstract readonly align: Signal<'start' | 'end'>;
  abstract readonly sortable: Signal<boolean>;
  /** Its cells name their rows (`rowheader`); without one marked, the first column's do. */
  abstract readonly rowHeader: Signal<boolean>;
  /** The direction its first press sorts in, when not the grid's. */
  abstract readonly sortStart: Signal<'asc' | 'desc' | undefined>;
  /** Classes on its header and cells, for the page's own styles. */
  abstract readonly cellClass: Signal<string>;
  /** Its cells' template; none shows the item's field of its name. */
  abstract readonly cell: Signal<TemplateRef<CellContext<unknown>> | null>;
  /** Its header's template, for a header that draws columns' own; none shows its `header`. */
  abstract readonly headerTemplate: Signal<TemplateRef<void> | null>;
}

/**
 * A column of a data grid, declared inside it: `<hrs-column name="kills" header="Kills"
 * width="6ch" align="end" sortable />`, with an `hrsCell` template for anything beyond plain text
 * (and an `hrsHeader` one for a header drawing columns' own). It draws nothing itself.
 */
@Component({
  selector: 'hrs-column',
  template: '',
  providers: [{ provide: DataGridColumn, useExisting: GridColumn }],
  host: { style: 'display: none' },
})
export class GridColumn extends DataGridColumn {
  readonly name = input.required<string>();
  readonly header = input('');
  readonly width = input('auto');
  readonly align = input<'start' | 'end'>('start');
  readonly sortable = input(false, { transform: booleanAttribute });
  readonly rowHeader = input(false, { transform: booleanAttribute });
  readonly sortStart = input<'asc' | 'desc' | undefined>(undefined);
  readonly cellClass = input('');

  private readonly cellTemplate = contentChild(CellTemplate);
  private readonly ownHeader = contentChild(HeaderTemplate);
  readonly cell = computed(
    () => (this.cellTemplate()?.template ?? null) as TemplateRef<CellContext<unknown>> | null,
  );
  readonly headerTemplate = computed(() => this.ownHeader()?.template ?? null);
}

/** The widths a header cell wants, px: the least (its label wrapped) and the most (on one line). */
export interface HeaderWidth {
  readonly min: number;
  readonly max: number;
}

/**
 * What a data grid gives the parts attached to it by reference (a header, a column setup), for
 * any item type.
 */
export interface AttachableGrid {
  /** Every column declared in it, shown or not. */
  readonly columns: Signal<readonly DataGridColumn[]>;
  /** The columns shown, in order. */
  readonly shownColumns: Signal<readonly DataGridColumn[]>;
  /** The columns shown, by name, in order; null shows them all as declared. */
  readonly displayedColumns: ModelSignal<readonly string[] | null>;
  /** The columns' widths as laid out (`grid-template-columns`, in px). */
  readonly columnTracks: Signal<string>;
  /** The rows' width as laid out, px. */
  readonly rowsWidth: Signal<number>;
  /** How far it is scrolled sideways, px, and whether it is. */
  readonly scrollLeft: Signal<number>;
  readonly scrolled: Signal<boolean>;
  /** Its order, which a header changes; and the direction a column's first press sorts in. */
  readonly sort: ModelSignal<GridSort | null>;
  readonly sortStart: Signal<'asc' | 'desc'>;
  /** A header's row (its id), for screen readers to read as the grid's; returns its detaching. */
  attachHeader(rowId: string): () => void;
  /** The widths a header's cells want, px, by column: the columns sized by them as by their cells. */
  setHeaderWidths(widths: Readonly<Record<string, HeaderWidth>>): void;
}
