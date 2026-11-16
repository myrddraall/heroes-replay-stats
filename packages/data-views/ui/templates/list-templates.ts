import { Directive, inject, TemplateRef } from '@angular/core';

/** What an item's template gets: the item, and where it is among all of them. */
export interface ItemContext<T> {
  readonly $implicit: T;
  readonly index: number;
  readonly count: number;
  /** How many items a row holds now: the first row is `index < columns`. */
  readonly columns: number;
}

/** How each item is drawn (`*hrsItem="let item"`). */
@Directive({ selector: 'ng-template[hrsItem]' })
export class ItemTemplate<T> {
  readonly template = inject<TemplateRef<ItemContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: ItemTemplate<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a type guard names what it guards
    _ctx: unknown,
  ): _ctx is ItemContext<T> {
    return true;
  }
}

/** What a group's header gets: the group's name. */
export interface GroupContext {
  readonly $implicit: string;
}

/** How a group's header is drawn (`*hrsGroupHeader="let group"`); without one, the group's name. */
@Directive({ selector: 'ng-template[hrsGroupHeader]' })
export class GroupHeaderTemplate {
  readonly template = inject<TemplateRef<GroupContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: GroupHeaderTemplate,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a type guard names what it guards
    _ctx: unknown,
  ): _ctx is GroupContext {
    return true;
  }
}

/** What shows when there are no items (`*hrsEmpty`). */
@Directive({ selector: 'ng-template[hrsEmpty]' })
export class EmptyTemplate {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/** What a placeholder gets: the index of the item it stands in for. */
export interface PlaceholderContext {
  readonly $implicit: number;
}

/** How an item still loading is drawn (`*hrsPlaceholder="let index"`); without one, the theme's placeholder. */
@Directive({ selector: 'ng-template[hrsPlaceholder]' })
export class PlaceholderTemplate {
  readonly template = inject<TemplateRef<PlaceholderContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: PlaceholderTemplate,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a type guard names what it guards
    _ctx: unknown,
  ): _ctx is PlaceholderContext {
    return true;
  }
}

/**
 * Marks what in an item takes the focus (its link or main button), when it has one: the arrow
 * keys move between these, and only the current one is a Tab stop. Without it, the item itself.
 */
@Directive({ selector: '[hrsItemFocus]' })
export class ItemFocus {}

/** The attribute `ItemFocus` leaves on its element, to find it by. */
export const ITEM_FOCUS = 'hrsitemfocus';
