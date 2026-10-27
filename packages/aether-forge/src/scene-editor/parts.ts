import type { CreatedShape, PartSettings } from '@myrddraall/heroes-replay-stats-aether/formats';
import { patchState } from '@ngrx/signals';
import {
  addMaterial,
  addReused,
  addShape,
  removeMaterial,
  removePart,
  settingsAsOverlay,
} from '../parts/part-hosts';
import { SKY, atBody, bodyKey } from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { SceneWrites } from './scene-writes';
import { bodyEdits } from '../editing/body-edits';

/** The parts of a body or the sky: their settings, those added, their materials, saved as an overlay. */
export function partMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, settings, wear, selectAdded, levelAt } = w;
  return {
    setPart(change: Partial<PartSettings>): void {
      const t = store.target();
      if (t.kind === 'sky-part') d.setSkyPart(store.scene(), t.key, change);
      else if (t.kind === 'part') {
        const level = levelAt(t.path);
        if (level) bodyEdits.setPart(level, t.key, change);
      }
    },
    clearPart(keys?: readonly (keyof PartSettings)[]): void {
      const t = store.target();
      if (t.kind === 'sky-part') d.clearSkyPart(store.scene(), t.key, keys);
      else if (t.kind === 'part') {
        const level = levelAt(t.path);
        if (level) bodyEdits.clearPart(level, t.key, keys);
      }
    },
    /** A new part of a shape added onto the body or sky selected: selected. */
    addPart(shape: CreatedShape): void {
      const host = store._addHost();
      if (host) selectAdded(addShape(host, shape));
    },
    /** One of the game data's parts added onto the body or sky selected, reused: selected. */
    reusePart(value: string): void {
      const host = store._addHost();
      const reused = host && store._catalog.reusableParts()[host.kind][Number(value)];
      if (host && reused) selectAdded(addReused(host, reused));
    },
    /** The selected part taken off (one added in the scene): its owner selected. */
    removePart(): void {
      const at = store._partHost();
      const t = store.target();
      if (!at) return;
      removePart(at.host, at.id);
      patchState(store, { selected: t.kind === 'part' ? bodyKey(t.path) : SKY });
    },
    addPartMaterial(name: string): void {
      const at = store._partHost();
      const source = store._catalog.materialSource()(name);
      if (at && source) addMaterial(at.host, at.id, name, source);
    },
    removePartMaterial(name: string): void {
      const at = store._partHost();
      if (at) removeMaterial(at.host, at.id, name);
    },
    /**
     * The parts added onto the body or sky selected saved as a new overlay, worn in their place
     * (what was set for them kept, as the overlay's).
     */
    saveAsOverlay(): void {
      const host = store._addHost();
      const t = store.target();
      if (!host?.parts.length) return;
      const parts = host.parts;
      const id = d.createOverlay(host.kind, parts);
      if (atBody(t)) {
        settings(t.path, (s) => settingsAsOverlay(s, id, parts));
        wear((worn) => [...worn, id]);
      } else {
        d.changeSky(store.scene(), (sky) => settingsAsOverlay(sky, id, parts));
        d.setSkyOverlays(store.scene(), [...store.skyWorn(), id]);
      }
    },
  };
}
