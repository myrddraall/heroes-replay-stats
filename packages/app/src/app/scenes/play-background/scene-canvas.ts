import {
  afterRenderEffect,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DEFAULT_DRAWING } from './background.store';
import type { LoadedPlayScene } from './play-scene';
import { SceneRenderer } from './scene-renderer';
import { NO_TINTS, sameTints, type Tints } from './scene-tints';

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

/** What the running scene is told of a change of its inputs. */
interface Running {
  retint(tints: Tints): void;
  play(): void;
  resize(): void;
  newPicture(): void;
}

/**
 * A loaded scene drawn into a canvas that fills this element (presentational), at a share of the
 * screen's resolution (`resolution`) whatever its size.
 * Animated, it is drawn up to `fps` frames a second, `fadeFps` while a change of tint fades in
 * (0: none till it rises again), and only while it can be seen (the tab shown, the element on
 * screen). Not animated, it is drawn once, then again for each new `picture`, at the time it is
 * then, cross-fading from the last; with reduced motion asked for, it is drawn once, still, and a
 * change shows at once.
 * It is always first drawn untinted, and fades into `tints`. Without WebGL 2 it stays empty: the
 * element's own background shows.
 */
@Component({
  selector: 'hrs-scene-canvas',
  templateUrl: './scene-canvas.html',
  styleUrl: './scene-canvas.scss',
})
export class SceneCanvas {
  readonly scene = input.required<LoadedPlayScene>();
  /** The tints it is drawn in: the background's, then each planet's. */
  readonly tints = input<Tints>(NO_TINTS);
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

  /** Whether a frame has been drawn: the picture fades in then. */
  protected readonly drawn = signal(false);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  /** The last picture, over the new one as it fades away. */
  private readonly previous = viewChild.required<ElementRef<HTMLCanvasElement>>('previous');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private running?: Running;

  constructor() {
    effect(() => {
      const tints = this.tints();
      untracked(() => this.running?.retint(tints));
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
    afterRenderEffect((onCleanup) => {
      const loaded = this.scene();
      const canvas = this.canvas().nativeElement;
      const previous = this.previous().nativeElement;
      untracked(() => this.run(loaded, canvas, previous, onCleanup));
    });
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

    const draw = () => {
      renderer.draw(clock);
      drawnAt = performance.now();
      if (!this.drawn()) this.drawn.set(true);
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
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const fading = renderer.fade < 1;
      const fps = fading ? this.fadeFps() : this.fps();
      if (last !== undefined && (fps <= 0 || now - last < 1000 / fps - FRAME_SLACK_MS)) return;
      const step = last === undefined ? 0 : Math.min(MAX_STEP, (now - last) / 1000);
      clock += step;
      last = now;
      if (fading) renderer.fade = Math.min(1, renderer.fade + step / FADE_SECONDS);
      draw();
    };
    const play = () => {
      const animate =
        onScreen && !document.hidden && this.animate() && !reducedMotion.matches;
      if (animate && !frame) {
        last = undefined;
        frame = requestAnimationFrame(tick);
      } else if (!animate && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        if (renderer.fade < 1) {
          renderer.fade = 1; // a fade stopped part way shows where it was going
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
    this.running = {
      // New tints fade in the running animation's frames; where nothing animates, the picture
      // cross-fades to them.
      retint: (tints) => {
        if (sameTints(tints, renderer.tints)) return;
        if (frame) {
          renderer.fadingFrom = renderer.tints;
          renderer.tints = tints;
          renderer.fade = 0;
        } else {
          crossFadeTo(() => {
            renderer.tints = tints;
            renderer.fade = 1;
          });
        }
      },
      play,
      resize,
      newPicture: () => {
        if (frame || reducedMotion.matches || this.animate()) return;
        crossFadeTo(() => (clock += (performance.now() - drawnAt) / 1000));
      },
    };
    renderer.tints = NO_TINTS; // always shown untinted first
    resize();
    play();
    this.running.retint(this.tints());

    onCleanup(() => {
      this.running = undefined;
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
