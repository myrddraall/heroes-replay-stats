import { Component, ElementRef, inject, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** One thing in the list: what opens it (its key), how it is shown, whether it is saved. */
export interface BrowserItem {
  readonly key: string;
  readonly label: string;
  /** A second, quieter line (where it is used, what it is of). */
  readonly caption?: string;
  readonly unsaved?: boolean;
  /** The group it is listed under (a heading where the groups change), where the list has groups. */
  readonly group?: string;
  /** A button after it that does one thing to it (`itemAction`): its icon, and what it does. */
  readonly action?: { readonly icon: string; readonly label: string };
}

/**
 * The library's list (presentational): one kind of thing, flat (under a heading for each group,
 * where its items have groups); an item clicked (`itemClick`: a double-click is two, told apart by
 * what holds the list, as the list may be new between them), selected by the up and down arrows
 * (shown, its information beside), opened by Enter, by its key; the one selected marked. An item
 * with an action has a button for it after its name (`itemAction`).
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
  readonly itemClick = output<string>();
  readonly itemSelect = output<string>();
  readonly itemOpen = output<string>();
  readonly itemAction = output<string>();
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
