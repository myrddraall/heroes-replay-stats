import { CdkDrag, CdkDragHandle, type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
} from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { StatColumn, StatColumnChoice } from '../../../model';
import { STAT_SUPPORT_LABELS } from '../stat-support';

/**
 * Which stat columns a table shows and in what order (presentational): each column checked to
 * show it, dragged by its handle to reorder, or moved with the arrow keys on the handle. Choices
 * without a known column are left out.
 */
@Component({
  selector: 'ui-stat-column-picker',
  imports: [CdkDrag, CdkDragHandle, CdkDropList, MatCheckbox, MatIcon, MatTooltip],
  templateUrl: './stat-column-picker.html',
  styleUrl: './stat-column-picker.scss',
})
export class StatColumnPicker {
  /** Every column a choice can name. */
  readonly columns = input.required<readonly StatColumn[]>();
  readonly choices = model.required<readonly StatColumnChoice[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected readonly supportLabels = STAT_SUPPORT_LABELS;
  private readonly byId = computed(() => new Map(this.columns().map((c) => [c.id, c])));
  protected readonly items = computed(() =>
    this.choices().flatMap((choice, index) => {
      const column = this.byId().get(choice.id);
      return column ? [{ choice, column, index }] : [];
    }),
  );

  protected setShown(id: string, shown: boolean): void {
    this.choices.update((choices) => choices.map((c) => (c.id === id ? { ...c, shown } : c)));
  }

  protected move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.choices().length) return;
    this.choices.update((choices) => {
      const next = [...choices];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  /** Move a column one place up or down from the keyboard, keeping the focus on its handle. */
  protected moveBy(event: Event, id: string, by: -1 | 1): void {
    event.preventDefault();
    const from = this.choices().findIndex((c) => c.id === id);
    this.move(from, from + by);
    afterNextRender(
      () => this.host.querySelector<HTMLElement>(`[column="${CSS.escape(id)}"]`)?.focus(),
      { injector: this.injector },
    );
  }

  protected dropped(event: CdkDragDrop<unknown>): void {
    const items = this.items();
    const from = items[event.previousIndex]?.index;
    const to = items[event.currentIndex]?.index;
    if (from !== undefined && to !== undefined) this.move(from, to);
  }

  protected tooltip(column: StatColumn): string {
    return [column.description, ...(column.notes ?? [])].filter(Boolean).join(' — ');
  }
}
