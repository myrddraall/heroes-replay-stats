import { Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { BACKGROUND_DESIGN, BACKGROUND_SCENE } from './background-design.tokens';
import { BUILT_IN_PLANETS } from './built-in-planets';
import { type LibraryState, skyWithLibrary, withLibrary } from './background-design';
import { BackgroundStore } from './background.store';
import { playSet, randomSet, seeded, type SetPlanet } from './planet-sets';
import { loadPlayScene, PLAY_SCENE_URL } from './play-scene';
import { SceneCanvas } from './scene-canvas';
import {
  type LoadedPlanet,
  loadPlanetIndex,
  PlanetLoader,
  type PlanetIndex,
} from './scene-planets';
import type { PlanetPlacement } from './scene-renderer';
import { browserColourParser, rendererTint } from './scene-tints';
import { backgroundTints } from './tint-settings';

/** What a set needs loaded: its planets and their styles, by id. */
const neededBy = (set: readonly SetPlanet[]) => [
  ...new Set(set.flatMap((p) => (p.style ? [p.id, `style-${p.style}`] : [p.id]))),
];

/**
 * The game's Play screen background (container): its sky, the energy drifting across the horizon,
 * the twinkling stars and the planets, from the scene heroes-capture exports, filling this element,
 * drawn as the BackgroundStore says. It shows the scene a container above it provides
 * (`BACKGROUND_SCENE`: an editor's), else the site's random sets by the BackgroundStore's number;
 * either way each planet and the sky as the library in effect has them (`BACKGROUND_DESIGN`: the
 * published design, or a draft where one is provided), under what the scene sets. Each planet is
 * loaded the first time it is shown; the last set stays up until a new one has loaded. Black
 * until the scene has loaded, or if it can't be.
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
  /** Whether a planet can be picked by a click (an editor's): `planetPick` gives its index in the set shown. */
  readonly pickable = input(false);
  readonly planetPick = output<number>();

  protected readonly store = inject(BackgroundStore);
  private readonly design = inject(BACKGROUND_DESIGN);
  private readonly source = inject(BACKGROUND_SCENE, { optional: true });
  /** Planets the app makes (an editor's stand-in), where a container above provides them. */
  private readonly builtIns = inject(BUILT_IN_PLANETS, { optional: true });
  /**
   * Which scene is shown, for how a change is drawn: the source's (its planets edited in place),
   * or the random set's number (another set flown to).
   */
  protected readonly sceneKey = computed(() =>
    this.random() ? `sets:${this.store.planetSet()}` : `scene:${this.source?.key?.() ?? ''}`,
  );
  /** An editing backdrop in place of the sky, where the scene shown has one. */
  protected readonly backdrop = computed(() => this.source?.backdrop?.() ?? null);
  protected readonly drawing = this.store.drawing;
  private readonly parse = browserColourParser();
  /** The tint over the whole picture: the scene's, where it has one; else the site's. */
  protected readonly tint = computed(() => {
    const own = this.source?.tint();
    return rendererTint(own ? backgroundTints(own) : this.store.tints(), this.parse);
  });
  /** The scene's lights, where there is a scene that has any. */
  protected readonly sceneLights = computed(() => this.source?.lights?.() ?? []);
  /** The sky: the scene's, where there is one, over the library's. */
  protected readonly sky = computed(() =>
    skyWithLibrary(this.source?.sky(), this.design.library()),
  );

  protected readonly scene = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlayScene(params, abortSignal),
  });
  private readonly index = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlanetIndex(params, abortSignal),
  });
  private readonly planets = computed(
    () => new PlanetLoader(this.src(), this.builtIns ?? undefined),
  );
  /** The set up: the scene's, where there is one; else the game's own for 0, else one drawn from the number. */
  /** Whether the random sets are shown: the site's, or a scene that is the random sets'. */
  private readonly random = computed(() => !this.source || (this.source.random?.() ?? false));
  /**
   * The set up: the scene's, where there is one (while what it needs loads, the one up stays);
   * else the game's own for 0, else one drawn from the number.
   */
  private readonly set = linkedSignal<
    {
      scene: readonly SetPlanet[] | null | undefined;
      random: boolean;
      number: number;
      index: PlanetIndex | null;
    },
    readonly SetPlanet[] | null
  >({
    source: () => ({
      scene: this.source?.planets(),
      random: this.random(),
      number: this.store.planetSet(),
      index: this.index.hasValue() ? this.index.value() : null,
    }),
    computation: ({ scene, random, number, index }, previous) => {
      if (!random) return scene ?? previous?.value ?? null;
      if (!index) return null;
      return number === 0 ? playSet(index) : randomSet(index, seeded(number));
    },
  });
  /** What the set needs loaded, as a key: loading follows it alone (not every change of a setting). */
  private readonly needed = computed(() => {
    const set = this.set();
    return set ? neededBy(set).join(',') : null;
  });
  /** The planets and styles the set needs, loaded. */
  private readonly loaded = resource({
    params: () => this.needed() ?? undefined,
    loader: async ({ params, abortSignal }) => {
      const loader = this.planets();
      const ids = params ? params.split(',') : [];
      const files = await Promise.all(ids.map((id) => loader.load(id, abortSignal)));
      return new Map<string, LoadedPlanet>(ids.map((id, i) => [id, files[i]!]));
    },
  });
  /**
   * What is shown: the set placed, each planet as the library has it under what the set says, as
   * soon as all it needs has loaded; until then the last.
   */
  protected readonly shown = linkedSignal<
    {
      set: readonly SetPlanet[] | null;
      loaded: Map<string, LoadedPlanet> | undefined;
      library: LibraryState;
    },
    readonly PlanetPlacement[] | null
  >({
    source: () => ({
      set: this.set(),
      loaded: this.loaded.hasValue() ? this.loaded.value() : undefined,
      library: this.design.library(),
    }),
    computation: ({ set, loaded, library }, previous) => {
      if (set?.length === 0) return []; // no planets: nothing to wait for
      if (!set || !loaded) return previous?.value ?? null;
      const out: PlanetPlacement[] = [];
      for (const p of set.map((s) => withLibrary(s, library))) {
        const planet = loaded.get(p.id);
        const style = p.style ? loaded.get(`style-${p.style}`) : undefined;
        if (!planet || (p.style && !style)) return previous?.value ?? null;
        out.push({
          planet,
          style,
          ...(p.enabled === false ? { hidden: true } : {}),
          position: p.position,
          radius: p.radius,
          materials: p.materials,
          parts: p.parts,
          order: p.order,
          lights: p.lights,
          added: p.added,
          tint: p.tint,
          lightFrom: p.lightFrom,
          rim: p.rim,
          lighting: p.lighting,
          shade: p.shade,
        });
      }
      return out;
    },
  });
}
