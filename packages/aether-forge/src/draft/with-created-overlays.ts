import {
  type AddedPart,
  type CreatedOverlay,
  type Design,
  nextOverlayId,
  type OverlayKind,
  sceneWithout,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { withOverlayParts } from '../editing/part-hosts';
import { designWrites } from './design-writes';

/** Overlays made in the editor: made, changed, deleted (and taken off whatever wore them). */
export function withCreatedOverlays() {
  return signalStoreFeature(
    { state: type<Design>() },
    withMethods((store) => {
      const { setLibrary, setScenes } = designWrites(store);
      return {
        /** A material's base settings, wherever it is used. */
        /**
         * A new overlay (to wear on a planet, or the sky), named: empty, or with parts (`parts`: as
         * added onto a body or a sky, each with where its materials are); its id.
         */
        createOverlay(kind: OverlayKind, parts: readonly AddedPart[] = []): string {
          const { id, n } = nextOverlayId(store.library());
          const label = `${kind === 'sky' ? 'Sky overlay' : 'Overlay'} ${n}`;
          const made = withOverlayParts({ kind, label, parts: [], sources: {} }, parts);
          setLibrary((l) => ({ ...l, created: { ...l.created, [id]: made } }));
          return id;
        },
        /** An overlay made in the editor changed (its parts, the materials they draw). */
        changeOverlay(id: string, change: (o: CreatedOverlay) => CreatedOverlay): void {
          setLibrary((l) => {
            const o = l.created?.[id];
            return o ? { ...l, created: { ...l.created, [id]: change(o) } } : l;
          });
        },
        /** An overlay made in the editor deleted: its settings too, and off whatever wears it. */
        deleteOverlay(id: string): void {
          setLibrary((l) => {
            const created = { ...l.created };
            const styles = { ...l.styles };
            delete created[id];
            delete styles[id];
            const worn = l.sky.overlays;
            const sky = worn ? { ...l.sky, overlays: worn.filter((o) => o !== id) } : l.sky;
            // Off the planets that chose it for themselves too.
            const planets = Object.fromEntries(
              Object.entries(l.planets).map(([k, p]) => [
                k,
                p.overlays?.includes(id)
                  ? { ...p, overlays: p.overlays.filter((o) => o !== id) }
                  : p,
              ]),
            );
            return { ...l, created, styles, sky, planets };
          });
          setScenes((s) => ({
            ...s,
            planets: Object.fromEntries(
              Object.entries(s.planets).map(([k, p]) => [k, sceneWithout(p, id)]),
            ),
          }));
        },
      };
    }),
  );
}
