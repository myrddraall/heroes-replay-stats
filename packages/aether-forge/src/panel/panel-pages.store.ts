import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { Editor } from '../editing/editor';
import { EditorUiStore } from '../layout/editor-ui.store';
import { pagesKind, panelPagesOf } from './panel-pages';

/**
 * The pages of the properties' panel (component store, provided by the selection panel): those
 * of what is selected, and the one shown, the last chosen for its kind (kept), else its first.
 */
export const PanelPagesStore = signalStore(
  withProps(() => ({ _editor: inject(Editor), _ui: inject(EditorUiStore) })),
  withComputed(({ _editor, _ui }) => {
    const pages = computed(() => panelPagesOf(_editor.kind(), _editor));
    return {
      pages,
      page: computed(() => {
        const list = pages();
        const kept = _ui.panelPages()[pagesKind(_editor.kind())];
        return list.find((p) => p.id === kept)?.id ?? list[0]?.id ?? '';
      }),
      options: computed(() => pages().map((p) => ({ value: p.id, label: p.label }))),
    };
  }),
  withMethods(({ _editor, _ui }) => ({
    show(page: string): void {
      _ui.showPanelPage(pagesKind(_editor.kind()), page);
    },
  })),
);
