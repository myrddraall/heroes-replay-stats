import type { TargetKind } from '../bodies/body';
import type { Editor } from '../editing/editor';

/** A page of the properties' panel: its settings grouped by what they are about. */
export interface PanelPage {
  readonly id: string;
  readonly label: string;
}

const page = (id: string, label: string): PanelPage => ({ id, label });

/**
 * The pages of the panel for what is selected, as the `Editor` in effect has it: each kind's own,
 * those with nothing on them left out (none, or one: no pages to choose).
 */
export function panelPagesOf(kind: TargetKind, editor: Editor): readonly PanelPage[] {
  switch (kind) {
    case 'body': {
      const b = editor.bodyView();
      if (!b) return [];
      const name = b.info.file?.kind === 'style' ? 'Overlay' : b.info.orbit ? 'Moon' : 'Planet';
      return [
        page('body', name),
        ...(editor.skyOverlayOpen() ? [] : [page('look', 'Look')]),
        ...(b.lights && !editor.skyOverlayOpen() && editor.litBy()
          ? [page('lighting', 'Lighting')]
          : []),
      ];
    }
    case 'material':
    case 'sky-material': {
      const m = editor.material();
      if (!m) return [];
      const look = !m.controls.particles || m.controls.spread;
      return [
        page('material', 'Material'),
        ...(look ? [page('look', 'Look')] : []),
        ...(m.controls.lit || m.controls.specular || editor.litBy()
          ? [page('lighting', 'Lighting')]
          : []),
      ];
    }
    case 'light': {
      const l = editor.light();
      if (!l) return [];
      return [page('light', 'Light'), ...(l.receivers.length ? [page('linking', 'Linking')] : [])];
    }
    case 'part':
      return editor.part()
        ? [
            page('part', 'Part'),
            page('shape', 'Shape'),
            ...(editor.litBy() ? [page('lighting', 'Lighting')] : []),
          ]
        : [];
    case 'camera':
      return [page('camera', 'Camera'), page('place', 'Place')];
    default:
      return [];
  }
}

/** The kind whose pages a selection's are (a sky's material's: a material's). */
export const pagesKind = (kind: TargetKind) => (kind === 'sky-material' ? 'material' : kind);
