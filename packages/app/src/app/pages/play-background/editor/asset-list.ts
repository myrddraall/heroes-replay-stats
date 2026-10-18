import { Component, ElementRef, inject, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** One thing in the list: what opens it (its key), how it is shown, whether it is saved. */
export interface BrowserItem {
  readonly key: string;
  readonly label: string;
  /** A second, quieter line (where it is used, what it is of). */
  readonly caption?: string;
  readonly unsaved?: boolean;
}

/**
 * The library's list (presentational): one kind of thing, flat; an item is selected by a click or
 * the up and down arrows (shown, its information beside) and opened by a double-click (or Enter),
 * by its key; the one selected marked.
 */
@Component({
  selector: 'hrs-asset-list',
  imports: [MatIcon],
  templateUrl: './asset-list.html',
  styleUrl: './asset-list.scss',
})
export class AssetList {
  readonly items = input.required<readonly BrowserItem[]>();
  /** Material Symbols' name for the kind of thing listed. */
  readonly icon = input('');
  /** The key of what is selected (shown). */
  readonly selected = input('');
  readonly itemSelect = output<string>();
  readonly itemOpen = output<string>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The item above or below selected, and focused. */
  protected move(event: Event, index: number, step: number): void {
    event.preventDefault();
    const next = this.items()[index + step];
    if (!next) return;
    this.itemSelect.emit(next.key);
    this.host.nativeElement.querySelectorAll<HTMLElement>('.item')[index + step]?.focus();
  }

  /** Enter opens what has the focus (as a double-click does), rather than only selecting it. */
  protected enter(event: Event, key: string): void {
    event.preventDefault();
    this.itemOpen.emit(key);
  }
}
