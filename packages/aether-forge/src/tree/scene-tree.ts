import { Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
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
  /**
   * Whether it is drawn, where it can be switched on and off (a material, a part, an overlay, a
   * body); none where it can't. Off, what is under it isn't drawn either.
   */
  readonly enabled?: boolean;
  /** Whether it differs from what is published (shown as a dot). */
  readonly unsaved?: boolean;
  /** Whether it only groups the rows under it (it folds, but has nothing of its own to select). */
  readonly group?: boolean;
  /** Whether it is an editing aid (the preview stage's), set apart from what is edited. */
  readonly aid?: boolean;
  /** Whether it can be moved among its siblings (a material, to change the order it is drawn in). */
  readonly movable?: boolean;
  /** Whether it is drawn opaque (a material: its icon marked so; drawn before the blended ones). */
  readonly opaque?: boolean;
}

/** A row moved to just before or after another (dragged there, or moved by Alt and an arrow). */
export interface TreeMove {
  readonly key: string;
  readonly target: string;
  readonly after: boolean;
}

/**
 * The scene as a tree (presentational), as a design tool's navigator shows a page: each row
 * indented under what it belongs to, folding its rows away, selected by a click or moved through
 * with the up and down arrows (a group only takes the focus), a material's drawing switched on
 * and off by its checkbox; a movable row dragged before or after another movable one (a line shows
 * where it goes), or moved past its neighbour with Alt and an arrow.
 */
@Component({
  selector: 'forge-scene-tree',
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
  readonly moved = output<TreeMove>();
  /** The rows under one switched off (not drawn, whatever their own switch says), by key. */
  protected readonly underOff = computed(() => {
    const out = new Set<string>();
    let offAt: number | null = null;
    for (const row of this.rows()) {
      if (offAt !== null && row.depth > offAt) out.add(row.key);
      else offAt = row.enabled === false ? row.depth : null;
    }
    return out;
  });
  /**
   * The rows in pods: what is edited, then the editing aids (each row with its place among all of
   * them, which the keys move by).
   */
  protected readonly pods = computed(() => {
    const rows = this.rows().map((row, index) => ({ row, index }));
    return [
      { aid: false, label: 'Scene', rows: rows.filter(({ row }) => !row.aid) },
      { aid: true, label: 'Editing aids', rows: rows.filter(({ row }) => row.aid) },
    ].filter((pod) => pod.rows.length);
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The row being dragged, and where it would go (before or after a row) if dropped now. */
  private dragging: string | null = null;
  protected readonly dropAt = signal<{ key: string; after: boolean } | null>(null);

  protected dragStart(row: TreeRow, event: DragEvent): void {
    if (!row.movable) return;
    this.dragging = row.key;
    event.dataTransfer?.setData('text/plain', row.label);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOver(row: TreeRow, event: DragEvent): void {
    if (!this.dragging || !row.movable || row.key === this.dragging) return;
    event.preventDefault();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after = event.clientY > box.top + box.height / 2;
    const at = this.dropAt();
    if (at?.key !== row.key || at.after !== after) this.dropAt.set({ key: row.key, after });
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    const at = this.dropAt();
    if (this.dragging && at)
      this.moved.emit({ key: this.dragging, target: at.key, after: at.after });
    this.dragEnd();
  }

  protected dragEnd(): void {
    this.dragging = null;
    this.dropAt.set(null);
  }

  /** The row moved past its movable neighbour above or below (one of the same depth, next to it). */
  protected moveBy(event: Event, index: number, step: number): void {
    const rows = this.rows();
    const row = rows[index];
    if (!row?.movable) return;
    event.preventDefault();
    let i = index + step;
    while (rows[i] && rows[i]!.depth > row.depth) i += step; // past a sibling's own rows
    const next = rows[i];
    if (next?.movable && next.depth === row.depth)
      this.moved.emit({ key: row.key, target: next.key, after: step > 0 });
  }

  /** The row above or below selected (a group only focused), and focused. */
  protected move(event: Event, index: number, step: number): void {
    event.preventDefault();
    const next = this.rows()[index + step];
    if (!next) return;
    if (!next.group) this.rowSelect.emit(next.key);
    this.host.nativeElement.querySelectorAll<HTMLElement>('.name')[index + step]?.focus();
  }

  protected enabled(row: TreeRow, event: Event): void {
    this.enabledChange.emit({ key: row.key, enabled: (event.target as HTMLInputElement).checked });
  }
}
