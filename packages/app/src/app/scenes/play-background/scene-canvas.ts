import type { AddedLight } from './scene-lights';
import type { LightBeam } from './scene-beams';
import { FrameStats } from './frame-stats';
import {
  afterRenderEffect,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DEFAULT_DRAWING } from './background.store';
import { beyondEdge } from './planet-sets';
import type { LoadedPlayScene, SceneCameraSet } from './play-scene';
import type { SkySettings } from './scene-planets';
import { type Backdrop, type PlanetPlacement, SceneRenderer } from './scene-renderer';
import { NO_TINT, sameTint, type Tint } from './scene-tints';

/** Device pixels per CSS pixel at most: past this the extra sharpness isn't worth the fill rate. */
const MAX_PIXEL_RATIO = 2;
/** The longest step the clock takes between frames, in seconds (after a stall, no burst of particles). */
const MAX_STEP = 0.1;
/** A frame comes this early at most (vsync isn't exact): at 60 Hz and 12 a second, every fifth is drawn. */
const FRAME_SLACK_MS = 4;
/**
 * How long a change fades over: the half second the game's vs A.I. tint takes, and so a new picture
 * cross-fading from the last.
 */
const FADE_SECONDS = 0.5;
/**
 * The fly to another set of planets: how long (the first half the old ones leave, the second the
 * new ones arrive, each from or to beyond the edge of the view at its own depth, so none pops or
 * crosses another), how far the camera turns (radians) and the sky smears at its middle (the stars
 * streak then too), and the room a planet is given past the edge, in its own angular radius.
 */
const FLY_SECONDS = 2.2;
const FLY_YAW = 0.11;
/** How far the sky's layers smear across at the fly's middle, of the way round the sky (0.014: about 5 degrees, near the camera's turn). */
const FLY_SMEAR = 0.014;
const FLY_CLEARANCE = 1.3;

/** What the running scene is told of a change of its inputs. */
interface Running {
  retint(tint: Tint): void;
  play(): void;
  resize(): void;
  newPicture(): void;
  replace(placements: readonly PlanetPlacement[]): void;
  resky(sky: SkySettings): void;
  relight(lights: readonly AddedLight[]): void;
  rebackdrop(backdrop: Backdrop | null): void;
  rebeam(beams: readonly LightBeam[]): void;
  recamera(camera: SceneCameraSet | undefined): void;
}

/** A fly from one set of planets to the next, part way through. */
interface Fly {
  readonly from: readonly PlanetPlacement[];
  readonly to: readonly PlanetPlacement[];
  /** Which way: the planets slide to -x (1) or +x (-1) as the camera turns the other way. */
  readonly direction: 1 | -1;
  t: number;
}

const easeIn = (u: number) => u * u;

/** Whether two planets wear the same overlays, in the same order. */
const sameOverlays = (a: PlanetPlacement, b: PlanetPlacement) =>
  (a.overlays ?? []).length === (b.overlays ?? []).length &&
  (a.overlays ?? []).every((o, i) => o === b.overlays?.[i]);

/**
 * Whether two sets are the same planets wearing the same overlays, in the same order: the same
 * scene, its bodies perhaps moved or resized (a moon round its orbit), drawn again where they are
 * now rather than flown to.
 */
function sameBodies(a: readonly PlanetPlacement[], b: readonly PlanetPlacement[]): boolean {
  return (
    a.length === b.length && a.every((p, i) => p.planet === b[i]!.planet && sameOverlays(p, b[i]!))
  );
}
/** Whether two sets are the same planets in the same order, whatever overlays they wear. */
function samePlanets(a: readonly PlanetPlacement[], b: readonly PlanetPlacement[]): boolean {
  return a.length === b.length && a.every((p, i) => p.planet.id === b[i]!.planet.id);
}
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/** A planet's name's place over it: its name, and where it floats (shares of the canvas). */
interface Label {
  readonly id: string;
  readonly x: number;
  readonly top: number;
}

/** Whether names would show where they already do. */
const sameLabels = (a: readonly Label[], b: readonly Label[]) =>
  a.length === b.length &&
  a.every((l, i) => l.id === b[i]!.id && l.x === b[i]!.x && l.top === b[i]!.top);

/**
 * A loaded scene drawn into a canvas that fills this element (presentational), at a share of the
 * screen's resolution (`resolution`) whatever its size.
 * Animated, it is drawn up to `fps` frames a second, `fadeFps` while a change of tint fades in
 * (0: none till it rises again), and only while it can be seen (the tab shown, the element on
 * screen). Not animated, it is drawn once, then again for each new `picture`, at the time it is
 * then, cross-fading from the last; with reduced motion asked for, it is drawn once, still, and a
 * change shows at once.
 * It is always first drawn untinted, and fades into `tint`. The planets up are `placements`;
 * a new set is flown to while it animates (the camera turns, the planets slide out and the new
 * ones in, the stars streak), or cross-faded to where it doesn't. The sky's materials show as
 * `sky` says. Without WebGL 2 it stays empty: the element's own background shows.
 */
@Component({
  selector: 'hrs-scene-canvas',
  templateUrl: './scene-canvas.html',
  styleUrl: './scene-canvas.scss',
  host: {
    '(click)': 'clicked($event)',
    '(pointermove)': 'hovered($event)',
    '[class.pickable]': 'pickable()',
    '[class.over-planet]': 'overPlanet()',
  },
})
export class SceneCanvas {
  readonly scene = input.required<LoadedPlayScene>();
  /** The tint it is drawn in. */
  readonly tint = input<Tint>(NO_TINT);
  /** How the sky shows: its materials' settings by name (those not named as the data has them), its tint. */
  readonly sky = input<SkySettings>({});
  /** The scene's lights, lighting every planet (see `scene-lights.ts`). */
  readonly lights = input<readonly AddedLight[]>([]);
  /** An editing backdrop in place of the sky (none: the sky). */
  readonly backdrop = input<Backdrop | null>(null);
  /** Lights' beams shown over it (an editor's, of the light selected; none: none). */
  readonly beams = input<readonly LightBeam[]>([]);
  /** Where a scene puts the camera, over the game's (none: the game's). */
  readonly camera = input<SceneCameraSet | undefined>(undefined);
  /**
   * Which scene the planets are of: new planets under the same key are faded to in place (a
   * scene edited), under another flown to (another scene, another set). None: always flown to.
   */
  readonly sceneKey = input<string | null>(null);
  /** Whether its planets can be picked by a click (an editor's): `planetPick` gives the one clicked. */
  readonly pickable = input(false);
  /** A planet clicked, by its index in `placements`. */
  readonly planetPick = output<number>();
  /** Whether the pointer is over a planet that can be picked. */
  protected readonly overPlanet = signal(false);
  /** The planet under a point of the canvas, while the scene runs. */
  private pickAt?: (x: number, y: number) => number | null;
  /** Whether it moves. */
  readonly animate = input(DEFAULT_DRAWING.animate);
  /** Frames a second at most while it just moves (the scene's motion keeps its speed whatever it is). */
  readonly fps = input(DEFAULT_DRAWING.idleFps);
  /** Frames a second at most while it fades. */
  readonly fadeFps = input(DEFAULT_DRAWING.animationFps);
  /** The share of the display's resolution it is drawn at (0–1). */
  readonly resolution = input(DEFAULT_DRAWING.resolution);
  /** A new one asks for a new picture, when it doesn't move. */
  readonly picture = input(0);
  /** The planets up; null until a set has loaded. */
  readonly placements = input<readonly PlanetPlacement[] | null>(null);
  /** Whether each planet's name floats over it. */
  readonly names = input(false);

  /** Where the names go: each planet's, over the top of its body, as shares of the canvas. */
  protected readonly labels = signal<readonly Label[]>([]);

  /** Whether a frame has been drawn: the picture fades in then. */
  protected readonly drawn = signal(false);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  /** The last picture, over the new one as it fades away. */
  private readonly previous = viewChild.required<ElementRef<HTMLCanvasElement>>('previous');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  /** The frames' stats, timed while anything shows them. */
  private readonly frameStats = inject(FrameStats);
  private running?: Running;

  constructor() {
    effect(() => {
      const tint = this.tint();
      untracked(() => this.running?.retint(tint));
    });
    effect(() => {
      const sky = this.sky();
      untracked(() => this.running?.resky(sky));
    });
    effect(() => {
      const lights = this.lights();
      untracked(() => this.running?.relight(lights));
    });
    effect(() => {
      const backdrop = this.backdrop();
      untracked(() => this.running?.rebackdrop(backdrop));
    });
    effect(() => {
      const beams = this.beams();
      untracked(() => this.running?.rebeam(beams));
    });
    effect(() => {
      const camera = this.camera();
      untracked(() => this.running?.recamera(camera));
    });
    effect(() => {
      this.animate();
      untracked(() => this.running?.play());
    });
    effect(() => {
      this.resolution();
      untracked(() => this.running?.resize());
    });
    effect(() => {
      this.picture();
      untracked(() => this.running?.newPicture());
    });
    effect(() => {
      const placements = this.placements();
      if (placements) untracked(() => this.running?.replace(placements));
    });
    effect(() => {
      if (!this.names()) this.labels.set([]);
    });
    afterRenderEffect((onCleanup) => {
      const loaded = this.scene();
      const canvas = this.canvas().nativeElement;
      const previous = this.previous().nativeElement;
      untracked(() => this.run(loaded, canvas, previous, onCleanup));
    });
  }

  /** A click: the planet under it picked, where planets can be. */
  protected clicked(event: MouseEvent): void {
    if (!this.pickable()) return;
    const index = this.pickAt?.(event.offsetX, event.offsetY) ?? null;
    if (index !== null) this.planetPick.emit(index);
  }

  /** The pointer moved: whether it is over a planet to pick (shown by the cursor). */
  protected hovered(event: PointerEvent): void {
    if (!this.pickable()) return;
    this.overPlanet.set((this.pickAt?.(event.offsetX, event.offsetY) ?? null) !== null);
  }

  private run(
    loaded: LoadedPlayScene,
    canvas: HTMLCanvasElement,
    previous: HTMLCanvasElement,
    onCleanup: (cleanup: () => void) => void,
  ): void {
    let renderer: SceneRenderer;
    try {
      renderer = new SceneRenderer(canvas, loaded);
    } catch (error) {
      console.warn('the background scene is not drawn:', error);
      return;
    }
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let clock = 0;
    let last: number | undefined;
    /** When the last picture was drawn: a scene that doesn't move is drawn again at its time then. */
    let drawnAt = performance.now();
    let frame = 0;
    let onScreen = true;
    let crossFade: Animation | undefined;
    let shown: readonly PlanetPlacement[] = [];
    /** The scene the planets shown are of. */
    let shownKey: string | null = null;
    let fly: Fly | undefined;
    let flights = 0;

    const draw = () => {
      const timed = this.frameStats.watching();
      renderer.timing = timed;
      const start = timed ? performance.now() : 0;
      if (!renderer.draw(clock)) return; // its programs still compiling: nothing yet
      if (timed) {
        this.frameStats.frame(performance.now() - start);
        for (const ms of renderer.gpuTimes()) this.frameStats.gpu(ms);
      }
      drawnAt = performance.now();
      if (!this.drawn()) this.drawn.set(true);
      // The names moved only where the planets or the view did: the page is told only then.
      if (this.names()) {
        const anchors = renderer.anchors();
        if (!sameLabels(anchors, this.labels())) this.labels.set(anchors);
      }
    };
    /** Draws what `change` makes, the picture there was fading away over it. */
    const crossFadeTo = (change: () => void) => {
      if (reducedMotion.matches || !this.drawn()) {
        change();
        draw();
        return;
      }
      // The canvas isn't kept once shown: draw it again as it is, and copy it while it is there.
      draw();
      crossFade?.cancel();
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
      change();
      draw();
      crossFade = previous.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_SECONDS * 1000,
        easing: 'ease-in-out',
      });
      crossFade.onfinish = () => (previous.width = previous.height = 0);
    };
    /** Where a planet is just beyond the edge of the view on a side (-1 left, 1 right): its x. */
    const beyond = (p: PlanetPlacement, side: number): number => {
      const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
      return beyondEdge(
        p.position,
        p.radius,
        loaded.scene.camera,
        aspect,
        side,
        FLY_YAW,
        FLY_CLEARANCE,
      );
    };
    /** The fly, `step` seconds on: the camera turned, the planets slid, the stars streaked. */
    const flyOn = (step: number) => {
      if (!fly) return;
      fly.t = Math.min(1, fly.t + step / FLY_SECONDS);
      const u = fly.t;
      const bump = Math.sin(Math.PI * u);
      const leaving = easeIn(Math.min(1, u * 2));
      const arriving = easeOut(Math.max(0, u * 2 - 1));
      const at = (p: PlanetPlacement, x: number) => [x, p.position[1], p.position[2]] as const;
      const mix = (a: number, b: number, f: number) => a + (b - a) * f;
      renderer.setYaw(-fly.direction * FLY_YAW * bump);
      renderer.streak = bump;
      renderer.smear = FLY_SMEAR * bump;
      renderer.placePlanets([
        ...fly.from.map((p) => at(p, mix(p.position[0], beyond(p, -fly!.direction), leaving))),
        ...fly.to.map((p) => at(p, mix(beyond(p, fly!.direction), p.position[0], arriving))),
      ]);
      if (u >= 1) {
        const { to } = fly;
        fly = undefined;
        renderer.setYaw(0);
        renderer.streak = 0;
        renderer.smear = 0;
        renderer.setPlanets(to);
      }
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const fading = renderer.fade < 1 || fly !== undefined;
      const fps = fading ? this.fadeFps() : this.fps();
      if (last !== undefined && (fps <= 0 || now - last < 1000 / fps - FRAME_SLACK_MS)) return;
      const step = last === undefined ? 0 : Math.min(MAX_STEP, (now - last) / 1000);
      clock += step;
      last = now;
      // Nothing changed and nothing moves: the picture up is the one it would draw.
      if (!fading && !renderer.needsFrame(clock)) return;
      if (renderer.fade < 1) renderer.fade = Math.min(1, renderer.fade + step / FADE_SECONDS);
      flyOn(step);
      draw();
    };
    const play = () => {
      const animate = onScreen && !document.hidden && this.animate() && !reducedMotion.matches;
      if (animate && !frame) {
        last = undefined;
        frame = requestAnimationFrame(tick);
      } else if (!animate && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        if (renderer.fade < 1 || fly) {
          renderer.fade = 1; // a fade stopped part way shows where it was going
          if (fly) {
            renderer.setPlanets(fly.to);
            renderer.setYaw(0);
            renderer.streak = 0;
            renderer.smear = 0;
            fly = undefined;
          }
          draw();
        }
      }
    };
    const resize = () => {
      const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO) * this.resolution();
      renderer.resize(
        Math.max(1, Math.round(this.host.clientWidth * ratio)),
        Math.max(1, Math.round(this.host.clientHeight * ratio)),
      );
      draw(); // a resized canvas is cleared: draw it again now, not at the next frame
    };

    const sized = new ResizeObserver(resize);
    sized.observe(this.host);
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      play();
    });
    seen.observe(this.host);
    document.addEventListener('visibilitychange', play);
    reducedMotion.addEventListener('change', play);
    this.pickAt = (x, y) => {
      if (fly) return null; // mid-flight the planets up aren't the set's
      const w = Math.max(1, this.host.clientWidth);
      const h = Math.max(1, this.host.clientHeight);
      return renderer.pick(x / w, y / h, w / h);
    };
    this.running = {
      // A new tint fades in the running animation's frames; where nothing animates, the picture
      // cross-fades to it.
      retint: (tint) => {
        if (sameTint(tint, renderer.tint)) return;
        if (frame) {
          renderer.fadingFrom = renderer.tint;
          renderer.tint = tint;
          renderer.fade = 0;
        } else {
          crossFadeTo(() => {
            renderer.tint = tint;
            renderer.fade = 1;
          });
        }
      },
      // The sky's materials changed in how they show: drawn again as they are.
      resky: (sky) => {
        renderer.setSky(sky);
        if (!frame) draw();
      },
      // The scene's lights changed: drawn again lit by them.
      relight: (lights) => {
        renderer.setSceneLights(lights);
        if (!frame) draw();
      },
      rebackdrop: (backdrop) => {
        renderer.setBackdrop(backdrop);
        if (!frame) draw();
      },
      rebeam: (beams) => {
        renderer.setBeams(beams);
        if (!frame) draw();
      },
      // The camera moved (a scene's): drawn again from there.
      recamera: (camera) => {
        renderer.setCamera(camera);
        if (!frame) draw();
      },
      play,
      resize,
      newPicture: () => {
        if (frame || reducedMotion.matches || this.animate()) return;
        crossFadeTo(() => (clock += (performance.now() - drawnAt) / 1000));
      },
      // A new set of planets: the first is put up as it is; another is flown to while the scene
      // animates (the old ones keep their tints till they are gone), else cross-faded to. The
      // same planets, changed in how they show (a glow, a strength) or where they are (a moon
      // moved round its orbit), are drawn again as they are: no fly, no fade.
      replace: (placements) => {
        if (placements === shown) return;
        const before = shown;
        shown = placements;
        const key = untracked(() => this.sceneKey());
        const sameScene = key !== null && key === shownKey;
        shownKey = key;
        if (fly && sameBodies(fly.to, placements)) {
          // The planets being flown to, changed in how they show: the fly goes on, to them as they are now.
          fly = { ...fly, to: placements };
          renderer.setPlanets([...fly.from, ...placements]);
          flyOn(0);
        } else if (before.length && sameBodies(before, placements) && !fly) {
          renderer.setPlanets(placements);
          if (!frame) draw();
        } else if (before.length && (sameScene || samePlanets(before, placements)) && !fly) {
          // The same scene edited (a planet or moon added or taken out, a style changed): faded to
          // where it is, not flown to.
          crossFadeTo(() => renderer.setPlanets(placements));
        } else if (!before.length || reducedMotion.matches) {
          renderer.setPlanets(placements);
          if (!frame) draw();
        } else if (frame) {
          const direction = flights++ % 2 ? -1 : 1;
          fly = { from: before, to: placements, direction, t: 0 };
          renderer.setPlanets([...before, ...placements]);
          flyOn(0);
        } else {
          crossFadeTo(() => renderer.setPlanets(placements));
        }
      },
    };
    renderer.tint = NO_TINT; // always shown untinted first
    renderer.setSky(this.sky());
    renderer.setSceneLights(this.lights());
    renderer.setBackdrop(this.backdrop());
    renderer.setBeams(this.beams());
    renderer.setCamera(this.camera());
    resize();
    play();
    const placements = this.placements(); // may have loaded before the scene did
    if (placements) this.running.replace(placements);
    this.running.retint(this.tint());

    onCleanup(() => {
      this.running = undefined;
      this.pickAt = undefined;
      cancelAnimationFrame(frame);
      crossFade?.cancel();
      sized.disconnect();
      seen.disconnect();
      document.removeEventListener('visibilitychange', play);
      reducedMotion.removeEventListener('change', play);
      renderer.dispose();
    });
  }
}
