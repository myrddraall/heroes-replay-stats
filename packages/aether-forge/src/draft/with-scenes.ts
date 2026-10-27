import { type Design, PublishedDesignStore } from '@myrddraall/heroes-replay-stats-aether/design';
import {
  type AddedCamera,
  GAME_CAMERA,
  GROUP_PREFIX,
  type GroupPlacement,
  isGroup,
  ownScene,
  placesOnly,
  type PlanetChoices,
  sceneBodies,
  type SceneBody,
  without,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { AddedLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import { inject } from '@angular/core';
import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { designWrites } from './design-writes';

/** The scenes: each listed, named, with its planets, groups, cameras and lights. */
export function withScenes() {
  return signalStoreFeature(
    { state: type<Design>() },
    withMethods((store) => {
      const published = inject(PublishedDesignStore);
      const { setScenes, setScene } = designWrites(store);
      return {
        /**
         * A new scene: empty, or a copy of another (`from`: its id, and its planets as they are
         * shown, a preset's included), named (none: as it starts), saved as it is made. Its id
         * (`scene-<n>`, the first free).
         */
        createScene(
          from?: { readonly id: string; readonly bodies: readonly SceneBody[] },
          name?: string,
        ): string {
          const taken = store.scenes().planets;
          let n = 1;
          while (taken[`scene-${n}`]) n++;
          const id = `scene-${n}`;
          const sky = from ? taken[from.id]?.sky : undefined;
          const copy: PlanetChoices = {
            bodies: from ? structuredClone(from.bodies) : [],
            sky: sky ? structuredClone(sky) : undefined,
            name: name?.trim() || undefined,
          };
          setScenes((s) => ({ ...s, planets: { ...s.planets, [id]: copy } }));
          // A new scene starts saved: published as it is made (only it; the rest of the draft as it was).
          published.publishScene(id, copy);
          return id;
        },
        /** A scene named ('' takes its name off). */
        renameScene(id: string, name: string): void {
          setScene(id, (p) => ({ ...p, name: name.trim() || undefined }));
        },
        /**
         * A scene's planets as they are now: what kept its one planet before scenes had several
         * goes, all else it sets kept (its lights, groups, cameras, sky, its own variants).
         */
        setSceneBodies(id: string, bodies: readonly SceneBody[]): void {
          setScene(id, (p) => ({
            ...(without(p, ['planet', 'style', 'variants', 'moons']) ?? {}),
            bodies,
          }));
        },
        /** A scene taken out (a preset's or the stage's is only reset). */
        deleteScene(id: string): void {
          if (!ownScene(id)) {
            setScene(id, () => null);
            return;
          }
          setScenes((s) => {
            const planets = { ...s.planets };
            delete planets[id];
            // A group deleted: taken out of every scene (and group) it was put in.
            if (isGroup(id))
              for (const [key, p] of Object.entries(planets))
                if (p.groups?.some((g) => g.group === id)) {
                  const groups = p.groups.filter((g) => g.group !== id);
                  planets[key] = groups.length ? { ...p, groups } : (without(p, ['groups']) ?? {});
                }
            return { ...s, planets };
          });
        },
        /** A new group: empty, named (`Group <n>`), saved as it is made. Its id (`group-<n>`). */
        createGroup(): string {
          const taken = store.scenes().planets;
          let n = 1;
          while (taken[`${GROUP_PREFIX}${n}`]) n++;
          const id = `${GROUP_PREFIX}${n}`;
          const group: PlanetChoices = { group: true, bodies: [], name: `Group ${n}` };
          setScenes((s) => ({ ...s, planets: { ...s.planets, [id]: group } }));
          published.publishScene(id, group);
          return id;
        },
        /** Where a scene puts the camera, over the game's (none: the game's). */
        setSceneCamera(id: string, camera: PlanetChoices['camera']): void {
          setScene(id, (p) => ({ ...p, camera }));
        },
        /** The cameras added to a scene (none: none); its primary kept where it is still one of them. */
        setSceneCameras(id: string, cameras: readonly AddedCamera[]): void {
          setScene(id, (p) => {
            const primary = cameras.some((c) => c.id === p.primaryCamera)
              ? p.primaryCamera
              : undefined;
            return {
              ...p,
              cameras: cameras.length ? cameras : undefined,
              primaryCamera: primary,
            };
          });
        },
        /** The camera a scene is shown through, by id (none, or the game's: the game's). */
        setPrimaryCamera(id: string, camera: string | undefined): void {
          setScene(id, (p) => ({
            ...p,
            primaryCamera: camera === GAME_CAMERA ? undefined : camera,
          }));
        },
        /** The groups put in a scene (or a group), as they are to be; none: none. */
        setSceneGroups(id: string, groups: readonly GroupPlacement[]): void {
          setScene(id, (p) => ({ ...p, groups: groups.length ? groups : undefined }));
        },
        /**
         * A scene back as the library has it: its planets' styles, looks and moons, its sky (a
         * scene of the user's own keeps its planets where they are, and its name; a preset, its own).
         */
        resetScene(id: string): void {
          setScene(id, (p) =>
            ownScene(id)
              ? {
                  name: p.name,
                  bodies: placesOnly(sceneBodies(p, id)),
                  // What it is, and the groups put in it where they are (as its planets are).
                  group: p.group,
                  groups: p.groups,
                  camera: p.camera,
                  cameras: p.cameras,
                  primaryCamera: p.primaryCamera,
                }
              : null,
          );
        },
        /** A scene's own lights (none: none). */
        setSceneLights(id: string, lights: readonly AddedLight[]): void {
          setScene(id, (p) => ({ ...p, lights: lights.length ? lights : undefined }));
        },
      };
    }),
  );
}
