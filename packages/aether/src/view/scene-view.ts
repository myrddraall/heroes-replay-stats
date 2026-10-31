import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  untracked,
  viewChild,
} from '@angular/core';
import { DESIGN_SOURCE, SCENE_SOURCE } from './sources';
import { BUILT_IN_PLANETS } from '../formats/built-in-planets';
import { type LibraryState, skyOverlaysOf, skyWithLibrary, withLibrary } from '../library/library';
import { ViewStore } from './view.store';
import {
  addedSourced,
  createdOf,
  createdPlanetFile,
  createdSkyFile,
  loadSources,
  lookupIn,
  overlayFileFor,
  type Sourced,
  sourceFiles,
  withAddedParts,
} from '../overlays/created-overlays';
import { type LoadedPlayScene, loadPlayScene, type SkyOverlayFile } from '../formats/play-scene';
import { playSet, randomSet, seeded, type SetPlanet } from '../planet-sets/planet-sets';
import { libraryMoonsOf, setWithMoons } from '../scenes/scene-moons';
import { DATA_URL } from '../formats/data-url';
import { SceneCanvas } from './scene-canvas';
import { type LoadedPlanet, loadPlanetIndex, PlanetLoader } from '../formats/planet-loader';
import type { PlanetIndex } from '../formats/planet-files';
import type { SkySettings } from '../sky/sky-settings';
import type { PlanetPlacement } from '../space/space';
import { keepUnchanged } from './stable-placements';
import { type BranchedPlacement, withFlowedLights } from '../bodies/flowed-lights';
import { browserColourParser } from '../tints/tints';
import { gradingOf, hexOf, NO_GRADING, pictureTint } from '../tints/grading';
import { presetColour, TINT_PRESETS } from '../tints/tint-presets';
import type { AddedPart } from '../formats/part-shapes';
import { overlayOfFile } from '../formats/overlay-files';

/** The images of the textures a file has, from those loaded. */
const imagesOf = (
  textures: Readonly<Record<string, unknown>>,
  images: Readonly<Record<string, ImageBitmap>>,
) => Object.fromEntries(Object.keys(textures).flatMap((k) => (images[k] ? [[k, images[k]]] : [])));

/**
 * What a set needs loaded: its planets, the overlays they wear, and the files what is added onto
 * them reads, by file id.
 */
const neededBy = (set: readonly SetPlanet[], file: (overlay: string) => string) => [
  ...new Set(
    set.flatMap((p) => [
      p.id,
      ...(p.overlays ?? []).map(file),
      ...sourceFiles(addedSourced(p.addedParts ?? [])),
    ]),
  ),
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
  selector: 'aether-scene-view',
  imports: [SceneCanvas],
  templateUrl: './scene-view.html',
  styleUrl: './scene-view.scss',
})
export class SceneView {
  /** Where the exported scene is served (the app's game data, by default). */
  readonly src = input(inject(DATA_URL));
  /** Whether each planet's name floats over it (to review them). */
  readonly names = input(false);
  /** Whether a planet can be picked by a click (an editor's): `planetPick` gives its index in the set shown. */
  readonly pickable = input(false);
  readonly planetPick = output<number>();
  /** A click on none of them. */
  readonly pickMissed = output<void>();
  /** The planet the pointer is over, by its index in the set shown (none: none). */
  readonly planetHover = output<number | null>();
  private readonly canvas = viewChild(SceneCanvas);
  /** How far the editor's aids show over it, 0 to 1 (see `SceneCanvas.aidsShown`): for markers laid over it. */
  readonly aidsShown = computed(() => this.canvas()?.aidsShown() ?? 0);

  protected readonly store = inject(ViewStore);
  private readonly design = inject(DESIGN_SOURCE);
  private readonly source = inject(SCENE_SOURCE, { optional: true });
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
  /** Lights' beams over it, where the scene shown has any. */
  protected readonly beams = computed(() => this.source?.beams?.() ?? []);
  /** How bright what is outside what an editor is in is drawn (1: as it is). */
  protected readonly dim = computed(() => this.source?.dim?.() ?? 1);
  protected readonly drawing = this.store.drawing;
  private readonly parse = browserColourParser();
  private readonly presets = inject(TINT_PRESETS);
  private readonly root = inject(DOCUMENT).documentElement;
  /** A colour as `#rrggbb` (any CSS colour, as the browser reads it), or null where it isn't one. */
  private hex(css: string): string | null {
    const rgb = this.parse(css);
    return rgb ? hexOf(rgb) : null;
  }
  /**
   * The colour grading: the scene's, where it has one (its theme colours as the theme has them);
   * else the site's tint over the picture.
   */
  protected readonly grading = computed(() => {
    const own = this.source?.grading();
    if (own !== undefined && own !== null)
      return gradingOf(own, (t) => {
        const preset = this.presets.find((p) => p.id === t.preset);
        const colour = preset?.token ? this.hex(presetColour(preset, this.root)) : null;
        return preset && colour ? pictureTint(colour, preset.blend, t.strength) : null;
      });
    const site = this.store.tints().background;
    const colour = site ? this.hex(site.colour) : null;
    return site && colour ? { light: [], picture: [pictureTint(colour, site.blend)] } : NO_GRADING;
  });
  /** Where the scene shown puts the camera, over the game's. */
  protected readonly camera = computed(() => this.source?.camera?.());
  /** The camera an anchored sky moves with, where the scene shown says (none: the one it is drawn through). */
  protected readonly skyFollow = computed(() => this.source?.skyFollow?.() ?? null);
  /** The scene's lights, where there is a scene that has any. */
  protected readonly sceneLights = computed(() => this.source?.lights?.() ?? []);
  /**
   * The sky: the scene's, where there is one, over the library's, wearing the overlays they say
   * (else its data's); those made in the editor with their files and images, once loaded.
   */
  protected readonly sky = computed((): SkySettings => {
    const wears = this.scene.hasValue() ? this.scene.value().scene.wears : undefined;
    const sky = skyWithLibrary(this.source?.sky(), this.design.library(), wears);
    const made = this.skyMade.hasValue() ? this.skyMade.value() : {};
    const own = sky.addedParts?.length && this.skyOwn.hasValue() ? this.skyOwn.value() : undefined;
    return { ...sky, made, ...(own ? { own } : {}) };
  });
  /** The parts added onto the sky (the library's, then the scene's), as a key to build them by. */
  private readonly skyOwnNeeded = computed(() => {
    const parts = skyWithLibrary(this.source?.sky(), this.design.library()).addedParts ?? [];
    return parts.length ? JSON.stringify(parts) : '';
  });
  /** Those parts built from where they are: their file as the sky draws it, and its textures' images. */
  private readonly skyOwn = resource({
    params: () => this.skyOwnNeeded() || undefined,
    loader: async ({ params, abortSignal }) => {
      const parts = JSON.parse(params) as AddedPart[];
      const { lookup, images } = await this.sources(addedSourced(parts), abortSignal);
      const file = createdSkyFile(addedSourced(parts), lookup);
      return { file, images: imagesOf(file.textures, images) };
    },
  });
  /** The sky's overlays made in the editor that it wears, as files to load (with their revisions). */
  private readonly skyMadeNeeded = computed(() => {
    const library = this.design.library();
    const wears = this.scene.hasValue() ? this.scene.value().scene.wears : undefined;
    return skyOverlaysOf(this.source?.sky(), library, wears)
      .filter((id) => library.created?.[id]?.kind === 'sky')
      .map((id) => overlayFileFor(library, id))
      .join(',');
  });
  /** Those overlays loaded: each one's file as the sky draws it, and its textures' images. */
  private readonly skyMade = resource({
    params: () => this.skyMadeNeeded() || undefined,
    loader: async ({ params, abortSignal }) => {
      const library = untracked(this.design.library);
      const out: Record<string, { file: SkyOverlayFile; images: Record<string, ImageBitmap> }> = {};
      for (const file of params.split(',')) {
        const o = createdOf(library, file);
        if (!o) continue;
        const { lookup, images } = await this.sources(o, abortSignal);
        const sky = createdSkyFile(o, lookup);
        out[overlayOfFile(file)] = { file: sky, images: imagesOf(sky.textures, images) };
      }
      return out;
    },
  });

  /** The scene loading (once for where it is served: what is made from it waits for the same). */
  private readonly sceneLoading = computed(() => loadPlayScene(this.src()));
  protected readonly scene = resource({
    params: () => this.sceneLoading(),
    loader: ({ params }) => params,
  });
  private readonly index = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlanetIndex(params, abortSignal),
  });
  /** Each planet's own variants as its data has them (the planet index's), by its id. */
  /** Each planet's index entry (its data's variants, and its overlays' switches), by its id. */
  private readonly planetData = computed(
    () =>
      new Map(
        (this.index.hasValue() ? this.index.value().planets : []).map((p) => [p.id, p] as const),
      ),
  );
  private readonly planets = computed(
    () => new PlanetLoader(this.src(), this.builtIns ?? undefined),
  );
  /**
   * The planets' overlays made in the editor, built, by file id (its revision: as it is now): each
   * once, from where its materials are in the game data.
   */
  private readonly madePlanets = computed(() => {
    this.planets(); // (made again for another source)
    return new Map<string, Promise<LoadedPlanet>>();
  });
  /** The file each overlay is loaded from, by its id (one made in the editor: as it is now). */
  private readonly overlayFile = computed(() => {
    const library = this.design.library();
    return (id: string) => overlayFileFor(library, id);
  });
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
    const library = this.design.library();
    if (!set) return null;
    // The random sets' planets bring their own moons (the library's) along.
    const moons = this.random()
      ? libraryMoonsOf(set, library).map((m): SetPlanet => ({
          id: m.id,
          position: [0, 0, 0],
          radius: 1,
          overlays: m.overlays,
        }))
      : [];
    return neededBy(
      [...set, ...moons].map((s) => withLibrary(s, library, this.planetData().get(s.id))),
      this.overlayFile(),
    ).join(',');
  });
  /** The planets and styles the set needs, loaded. */
  private readonly loaded = resource({
    params: () => this.needed() ?? undefined,
    loader: async ({ params, abortSignal }) => {
      const loader = this.planets();
      const library = untracked(this.design.library);
      const made = untracked(this.madePlanets);
      const load = (id: string) => {
        const o = createdOf(library, id);
        if (!o) return loader.load(id, abortSignal);
        let building = made.get(id);
        if (!building) {
          building = this.madePlanet(id, o);
          building.catch(() => made.delete(id)); // not kept: asked for again, it is tried again
          made.set(id, building);
        }
        return building;
      };
      const ids = params ? params.split(',') : [];
      const files = await Promise.all(ids.map(load));
      return new Map<string, LoadedPlanet>(ids.map((id, i) => [id, files[i]!]));
    },
  });
  /** A planet's overlay made in the editor, built from where its materials are (their files loaded). */
  private async madePlanet(id: string, o: Sourced): Promise<LoadedPlanet> {
    const { lookup, images } = await this.sources(o);
    const planet = createdPlanetFile(o, lookup);
    return { id, planet, images: imagesOf(planet.textures, images) };
  }

  /** What parts made in the editor are built from, loaded: the files their materials are in, the scene. */
  private sources(o: Sourced, signal?: AbortSignal) {
    const loader = untracked(this.planets);
    return loadSources(
      o,
      (id) => loader.load(id, signal),
      () => untracked(this.sceneLoading),
    );
  }

  /** Planets with the parts added onto them, by the planet and the parts (each built once). */
  private readonly withAdded = new WeakMap<LoadedPlanet, Map<string, LoadedPlanet>>();

  /**
   * A planet with the parts added onto it (its own, after its data's), built from the files loaded
   * and the scene: the same one for the same parts.
   */
  private addedOnto(
    planet: LoadedPlanet,
    parts: readonly AddedPart[],
    loaded: Map<string, LoadedPlanet>,
    scene: LoadedPlayScene,
  ): LoadedPlanet {
    const key = JSON.stringify(parts);
    let built = this.withAdded.get(planet);
    if (!built) this.withAdded.set(planet, (built = new Map()));
    const kept = built.get(key);
    if (kept) return kept;
    const files = Object.fromEntries([...loaded].map(([id, l]) => [id, l.planet]));
    const file = withAddedParts(planet.planet, parts, lookupIn(files, scene.scene));
    const images = Object.assign(
      {},
      scene.images,
      ...[...loaded.values()].map((l) => l.images),
      planet.images,
    ) as Record<string, ImageBitmap>;
    const out: LoadedPlanet = { ...planet, planet: file, images: imagesOf(file.textures, images) };
    built.set(key, out);
    return out;
  }

  /**
   * What is shown: the set placed, each planet as the library has it under what the set says, as
   * soon as all it needs has loaded; until then the last.
   */
  protected readonly shown = linkedSignal<
    {
      set: readonly SetPlanet[] | null;
      random: boolean;
      loaded: Map<string, LoadedPlanet> | undefined;
      library: LibraryState;
      scene: LoadedPlayScene | undefined;
    },
    readonly PlanetPlacement[] | null
  >({
    source: () => ({
      set: this.set(),
      random: this.random(),
      loaded: this.loaded.hasValue() ? this.loaded.value() : undefined,
      library: this.design.library(),
      scene: this.scene.hasValue() ? this.scene.value() : undefined,
    }),
    computation: ({ set, random, loaded, library, scene }, previous) => {
      if (set?.length === 0) return []; // no planets: nothing to wait for
      if (!set || !loaded) return previous?.value ?? null;
      // The random sets' planets with their own moons about them (placed once the scene's
      // camera is in; an editor's scene places its own).
      if (random && !scene && libraryMoonsOf(set, library).length) return previous?.value ?? null;
      const placed = random && scene ? setWithMoons(set, library, scene.scene.camera) : set;
      const file = this.overlayFile();
      const out: BranchedPlacement[] = [];
      const data = untracked(this.planetData);
      for (const p of placed.map((s) => withLibrary(s, library, data.get(s.id)))) {
        const own = loaded.get(p.id);
        const overlays = (p.overlays ?? []).map((id) => loaded.get(file(id)));
        if (!own || overlays.some((o) => !o)) return previous?.value ?? null;
        // What is added onto it is built once the scene is in too (a part may draw the sky's).
        if (p.addedParts?.length && !scene) return previous?.value ?? null;
        const planet =
          p.addedParts?.length && scene ? this.addedOnto(own, p.addedParts, loaded, scene) : own;
        const placement: PlanetPlacement = {
          planet,
          overlays: overlays.filter((o) => !!o),
          ...(p.enabled === false ? { hidden: true } : {}),
          ...(p.dimmed ? { dimmed: true } : {}),
          ...(p.dimmedOutside ? { dimmedOutside: p.dimmedOutside } : {}),
          position: p.position,
          radius: p.radius,
          materials: p.materials,
          base: p.base,
          parts: p.parts,
          order: p.order,
          lights: p.lights,
          added: p.added,
          tints: p.tints,
          tintsEnabled: p.tintsEnabled,
          lightFrom: p.lightFrom,
          rim: p.rim,
          lighting: p.lighting,
          shade: p.shade,
          ...(p.orientation ? { orientation: p.orientation } : {}),
          ...(p.axis ? { axis: p.axis } : {}),
          ...(p.turn !== undefined ? { turn: p.turn } : {}),
          ...(p.baseTurn ? { baseTurn: p.baseTurn } : {}),
        };
        out.push({ placement, id: p.id, ...(p.branch ? { branch: p.branch } : {}) });
      }
      // Each lit by what reaches it from elsewhere in the scene too (placed by its camera).
      const lit =
        scene && out.some((b) => b.branch)
          ? withFlowedLights(out, scene.scene.camera)
          : out.map((b) => b.placement);
      // Each body as it was where it hasn't changed: only a changed one is drawn again.
      return keepUnchanged(previous?.value, lit);
    },
  });
}
