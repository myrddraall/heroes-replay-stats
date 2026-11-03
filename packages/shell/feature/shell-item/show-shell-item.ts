import { computed, DestroyRef, inject } from '@angular/core';
import { ShellNavStore } from '../../data';
import type { ShellItem } from '../../model';

/**
 * What a page has open (a match, a map), for the shell's navigation while the page is shown: a
 * step in the breadcrumb and the tree, and with its sections, levels 2 and 3. Call it in the page's
 * injection context: `showShellItem(() => match() && { under: '/matches', label, link, sections })`.
 */
export function showShellItem(item: () => ShellItem | null): void {
  const nav = inject(ShellNavStore);
  const source = computed(item);
  nav.follow(source);
  inject(DestroyRef).onDestroy(() => nav.unfollow(source));
}
