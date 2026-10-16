import { Component, computed, inject, input, resource } from '@angular/core';
import { BackgroundStore } from './background.store';
import { playSet, randomSet, seeded } from './planet-sets';
import { loadPlayScene, PLAY_SCENE_URL } from './play-scene';
import { SceneCanvas } from './scene-canvas';
import { loadPlanetIndex, PlanetLoader } from './scene-planets';
import type { PlanetPlacement } from './scene-renderer';
import { browserColourParser, rendererTints } from './scene-tints';

/**
 * The game's Play screen background (container): its sky, the energy drifting across the horizon,
 * the twinkling stars and the planets, from the scene heroes-capture exports, filling this element,
 * tinted and drawn as the BackgroundStore says, with the set of planets it says up (each planet
 * loaded the first time a set has it). Black until the scene has loaded, or if it can't be.
 */
@Component({
  selector: 'hrs-play-background',
  imports: [SceneCanvas],
  templateUrl: './play-background.html',
  styleUrl: './play-background.scss',
})
export class PlayBackground {
  /** Where the exported scene is served. */
  readonly src = input(PLAY_SCENE_URL);
  /** Whether each planet's name floats over it (to review them). */
  readonly names = input(false);

  protected readonly store = inject(BackgroundStore);
  protected readonly drawing = this.store.drawing;
  private readonly parse = browserColourParser();
  protected readonly tints = computed(() => rendererTints(this.store.tints(), this.parse));

  protected readonly scene = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlayScene(params, abortSignal),
  });
  private readonly index = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlanetIndex(params, abortSignal),
  });
  private readonly planets = computed(() => new PlanetLoader(this.src()));
  /** The set up: the page's, if it holds one; else the game's own for 0, else one drawn from the number. */
  private readonly set = computed(() => {
    const index = this.index.hasValue() ? this.index.value() : null;
    if (!index) return null;
    const page = this.store.pagePlanets();
    if (page) return page;
    const number = this.store.planetSet();
    return number === 0 ? playSet(index) : randomSet(index, seeded(number));
  });
  /** The set's planets, loaded and placed; the last set's until the new one has loaded. */
  protected readonly placements = resource({
    params: () => this.set(),
    loader: async ({ params: set, abortSignal }): Promise<readonly PlanetPlacement[] | null> => {
      if (!set) return null;
      const loader = this.planets();
      const loaded = await Promise.all(set.map((p) => loader.load(p.id, abortSignal)));
      return set.map((p, slot) => ({ planet: loaded[slot]!, position: p.position, radius: p.radius, slot }));
    },
  });
  /** What is shown: a set that has loaded (a failed one leaves the last up). */
  protected readonly shown = computed(() =>
    this.placements.hasValue() ? this.placements.value() : null,
  );
}
