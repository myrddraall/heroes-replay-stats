import { computed } from '@angular/core';
import { type MaterialEntry, materialsOf } from '../../editing/model/materials';
import { type PartEntry, partsOfBody } from '../../editing/model/parts';
import type { WithBody } from '../asset-editor.store';

/** The materials and parts the asset open sets for itself (a sky overlay's: its own). */
export function ownViews(store: WithBody) {
  const { _skyOverlay, _skyOverlayMaterials, _body, _sceneFile, _skyOverlayParts } = store;

  return {
    /** The planet's or overlay's open materials (a sky overlay's: its own), as it sets them for itself. */
    _ownMaterials: computed((): MaterialEntry[] => {
      if (_skyOverlay()) return _skyOverlayMaterials();
      const b = _body();
      // Its layers may read the sky's textures too (always loaded).
      const sky = _sceneFile.hasValue() ? _sceneFile.value().textures : {};
      return b ? materialsOf(b, sky) : [];
    }),
    /** The planet's or overlay's open parts (a sky overlay's: about the eye), as it sets them for itself. */
    _ownParts: computed((): PartEntry[] => {
      if (_skyOverlay()) return _skyOverlayParts();
      const b = _body();
      return b ? partsOfBody(b) : [];
    }),
  };
}
