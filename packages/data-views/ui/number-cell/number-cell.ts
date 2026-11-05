import { booleanAttribute, Component, computed, input } from '@angular/core';

/** How a figure stands out: the best of its column, or the best within its row's group. */
export type NumberMark = 'best' | 'group-best';

/**
 * A figure in a data grid's cell (presentational): tabular figures, its short form when the table
 * is pressed for room, and marked when it is the best of its column or of its row's group, which
 * screen readers hear too. Plain, or in the game's display type (`styled`). Sized in em: its row's
 * type sizes it.
 */
@Component({
  selector: 'hrs-number-cell',
  templateUrl: './number-cell.html',
  styleUrl: './number-cell.scss',
  host: {
    '[class.number-cell--best]': "!styled() && mark() === 'best'",
    '[class.number-cell--group-best]': "!styled() && mark() === 'group-best'",
    // the theme's StyledText (nexus.css), as the game draws its score screen's figures
    '[class.hrs-styled]': 'styled()',
    '[class.hrs-styled--base]': 'styled() && mark() === null',
    '[class.hrs-styled--bright]': "styled() && mark() === 'best'",
    '[class.hrs-styled--glow]': "styled() && mark() === 'group-best'",
  },
})
export class NumberCell {
  /** The figure as shown in full: `39,609`. */
  readonly value = input.required<string>();
  /** Its short form (`39.6k`), shown instead when `short` is set. */
  readonly shortValue = input<string | null>(null);
  /** The table is pressed for room: the short form, when there is one. */
  readonly short = input(false);
  readonly mark = input<NumberMark | null>(null);
  /**
   * In the game's display type (the theme's StyledText): the figure in its row's colour, the best
   * of its group glowing, the best of its column bright; otherwise plain, marks in gold and accent.
   */
  readonly styled = input(false, { transform: booleanAttribute });
  /** What screen readers hear for a group's best: the group in the page's words. */
  readonly groupBestLabel = input('best in its group');

  protected readonly shown = computed(() =>
    this.short() ? (this.shortValue() ?? this.value()) : this.value(),
  );
  protected readonly markLabel = computed(() => {
    const mark = this.mark();
    return mark === 'best' ? '(best)' : mark === 'group-best' ? `(${this.groupBestLabel()})` : null;
  });
}
