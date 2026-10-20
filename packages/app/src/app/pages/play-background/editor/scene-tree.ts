import { Component, ElementRef, inject, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** A row of the scene tree, as shown: what it is, how deep, and how it can be acted on. */
export interface TreeRow {
  /** What it is, as the page knows it (selection, folding). */
  readonly key: string;
  readonly label: string;
  /** What it is beside its name, smaller (a material's name in the game data; a group's kind). */
  readonly detail?: string;
  /** Material Symbols' name for what kind of thing it is. */
  readonly icon: string;
  readonly depth: number;
  /** Whether it has rows under it, and whether they are shown. */
  readonly expandable: boolean;
  readonly expanded: boolean;
  /** Whether it is drawn, where it can be switched on and off (a material); none where it can't. */
  readonly enabled?: boolean;
  /** Whether it differs from what is published (shown as a dot). */
  readonly unsaved?: boolean;
  /** Whether it only groups the rows under it (it folds, but has nothing of its own to select). */
  readonly group?: boolean;
  /** Whether it is an editing aid (the preview stage's), set apart from what is edited. */
  readonly aid?: boolean;
}

/**
 * The scene as a tree (presentational), as a design tool's navigator shows a page: each row
 * indented under what it belongs to, folding its rows away, selected by a click or moved through
 * with the up and down arrows (a group only takes the focus), a material's drawing switched on
 * and off by its checkbox.
 */
@Component({
  selector: 'hrs-scene-tree',
  imports: [MatIcon],
  templateUrl: './scene-tree.html',
  styleUrl: './scene-tree.scss',
})
export class SceneTree {
  readonly rows = input.required<readonly TreeRow[]>();
  /** The selected row's key. */
  readonly selected = input<string>('');
  readonly rowSelect = output<string>();
  readonly expandToggle = output<string>();
  readonly enabledChange = output<{ key: string; enabled: boolean }>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The row above or below selected (a group only focused), and focused. */
  protected move(event: Event, index: number, step: number): void {
    event.preventDefault();
    const next = this.rows()[index + step];
    if (!next) return;
    if (!next.group) this.rowSelect.emit(next.key);
    this.host.nativeElement.querySelectorAll<HTMLElement>('.name')[index + step]?.focus();
  }

  /** Whether a row starts the aids (a divider before it). */
  protected startsAids(index: number): boolean {
    const rows = this.rows();
    return !!rows[index]?.aid && index > 0 && !rows[index - 1]?.aid;
  }

  protected enabled(row: TreeRow, event: Event): void {
    this.enabledChange.emit({ key: row.key, enabled: (event.target as HTMLInputElement).checked });
  }
}
