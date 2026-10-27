import { effect, untracked } from '@angular/core';
import type { Editor } from '../editing/editor';
import type { TreeRow } from './scene-tree';

/**
 * Whether what is selected is still there: a part, a light, a material (or one of its layers or
 * its shield shader), a shield's light, an overlay worn, a variant; none where it is something
 * else (left as it is).
 */
function stillThere(editor: Editor): boolean | undefined {
  switch (editor.kind()) {
    case 'part':
      return !!editor.part();
    case 'light':
      return !!editor.light();
    case 'overlay':
      return !!editor.overlayView();
    case 'variant':
      return editor.variantRows().some((v) => v.id === editor.selectedVariant());
    case 'material':
    case 'sky-material':
    case 'layer':
    case 'shader':
      return !!editor.material();
    case 'gridLight': {
      const view = editor.materialView();
      const lights = editor.material()?.values.gridLights ?? [];
      return view?.kind === 'gridLight' && lights.some((l) => l.id === view.id);
    }
    default:
      return undefined;
  }
}

/** The rows above a row in the tree, less deep each (its parent first, then its parent's). */
function ancestorsOf(rows: readonly TreeRow[], key: string): TreeRow[] {
  const at = rows.findIndex((r) => r.key === key);
  if (at < 0) return [];
  const above: TreeRow[] = [];
  let depth = rows[at]!.depth;
  for (let i = at - 1; i >= 0 && depth > 0; i--)
    if (rows[i]!.depth < depth) {
      above.push(rows[i]!);
      depth = rows[i]!.depth;
    }
  return above;
}

/**
 * What is selected taken away by a change of the draft (its Discard, an Undo): its parent in the
 * tree selected in its place, so its properties' panel isn't left empty. Gone: what it shows isn't
 * there any more, or its row is gone though the nearest row above it still shown is unfolded (a
 * material's row on a part taken away). Only once it was there (not while it is still loading).
 */
export function selectParentWhenGone(editor: Editor): void {
  let last: { readonly key: string; readonly rows: readonly TreeRow[] } | null = null;
  effect(() => {
    const key = editor.selected();
    const there = stillThere(editor);
    const rows = editor.rows();
    if (there === undefined) {
      last = null;
      return;
    }
    const shown = rows.some((r) => r.key === key);
    if (there && shown) last = { key, rows };
    if ((there && shown) || last?.key !== key) return;
    // Its nearest row above still shown: folded, it is only hidden (unless it isn't there).
    const ancestors = ancestorsOf(last.rows, key);
    const open = ancestors.map((a) => rows.find((r) => r.key === a.key)).find((r) => !!r);
    if (there && !open?.expanded) return;
    const to = ancestors.find((a) => rows.some((r) => r.key === a.key && !r.group))?.key;
    last = null;
    if (to) untracked(() => editor.select(to));
  });
}
