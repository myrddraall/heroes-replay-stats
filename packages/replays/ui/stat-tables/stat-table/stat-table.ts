import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChild, inject, input, LOCALE_ID, model } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { CellTemplate, DataGrid, GridColumn, HeaderTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import type { StatColumn, StatRow, StatSupport } from '../../../model';
import { statTableRows, type StatTableRow } from '../stat-cells';
import { StatRowHead } from '../stat-row-head';
import type { StatSort } from '../stat-sort';
import { STAT_SUPPORT_LABELS } from '../stat-support';

/**
 * A dense stat table (presentational, on the data grid): many stats in small type, one row per
 * player, the header and the row heads staying in view as the page and the table scroll. A stat whose figure is partial, flawed or not
 * recorded is starred, with a legend, and its notes are in its header's tooltip with its
 * description. The row head comes from a `uiStatRowHead` template inside. Unsorted, the rows
 * keep their given order.
 */
@Component({
  selector: 'ui-stat-table',
  imports: [CellTemplate, DataGrid, GridColumn, HeaderTemplate, MatTooltip, NgTemplateOutlet],
  templateUrl: './stat-table.html',
  styleUrl: './stat-table.scss',
})
export class StatTable<T> {
  readonly columns = input.required<readonly StatColumn[]>();
  readonly rows = input.required<readonly StatRow<T>[]>();
  /** What the row heads are, for the header over them. */
  readonly rowHeadLabel = input('Player');
  /** The table's order; none keeps the rows' own. */
  readonly sort = model<StatSort | null>(null);

  protected readonly rowHead = contentChild<StatRowHead<T>>(StatRowHead);
  private readonly locale = inject(LOCALE_ID);
  protected readonly table = computed(() =>
    statTableRows(this.rows(), this.columns(), this.sort(), this.locale, false),
  );
  protected readonly supportLabels = STAT_SUPPORT_LABELS;
  /** The kinds of limited support the shown columns have, for the legend. */
  protected readonly limits = computed(() => {
    const kinds = new Set(this.columns().map((c) => c.support ?? 'full'));
    return (['partial', 'flawed', 'none'] as const).filter((k) => kinds.has(k));
  });

  protected tooltip(column: StatColumn): string {
    return (
      [column.description, ...(column.notes ?? [])].filter(Boolean).join(' — ') || column.label
    );
  }

  protected isLimited(support: StatSupport | undefined): support is Exclude<StatSupport, 'full'> {
    return support !== undefined && support !== 'full';
  }

  protected readonly byKey = (line: StatTableRow<T>) => line.row.key;
  protected readonly themeOf = (line: StatTableRow<T>) => line.row.theme ?? null;
}
