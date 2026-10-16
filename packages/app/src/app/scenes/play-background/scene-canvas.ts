import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { LoadedPlayScene } from './play-scene';
import { SceneRenderer } from './scene-renderer';
import { browserColourParser, readTints, sameTints } from './scene-tints';

/** Device pixels per CSS pixel at most: past this the extra sharpness isn't worth the fill rate. */
const MAX_PIXEL_RATIO = 2;
/** The longest step the clock takes between frames, in seconds (after a stall, no burst of particles). */
const MAX_STEP = 0.1;
/**
 * Frames a second at most, unless told otherwise. The scene moves slowly (a scroll over 200 s, stars
 * fading over seconds), so more would cost the GPU, and the page compositing over it, without
 * showing much difference.
 */
export const DEFAULT_MAX_FPS = 12;
/** A frame comes this early at most (vsync isn't exact): at 60 Hz and 12 a second, every fifth is drawn. */
const FRAME_SLACK_MS = 4;
/** How long a change of tint fades over: the half second the game's vs A.I. tint takes. */
const TINT_FADE_SECONDS = 0.5;
/** How often the tints are looked at while nothing animates (with reduced motion asked for). */
const TINT_CHECK_MS = 250;

/**
 * A loaded scene drawn into a canvas that fills this element (presentational), at the screen's
 * resolution whatever its size, up to `maxFps` frames a second. It animates only while it can be
 * seen (the tab shown, the element on screen); with reduced motion asked for, it is drawn once, still. Without WebGL 2 it stays
 * empty: the element's own background shows. It is tinted as the CSS on this element says (see
 * readTints); a change fades in at the display's own rate, or shows at once where nothing animates.
 */
@Component({
  selector: 'hrs-scene-canvas',
  templateUrl: './scene-canvas.html',
  styleUrl: './scene-canvas.scss',
})
export class SceneCanvas {
  readonly scene = input.required<LoadedPlayScene>();
  /** Frames a second at most (the scene's motion keeps its speed whatever it is). */
  readonly maxFps = input(DEFAULT_MAX_FPS);

  /** Whether a frame has been drawn: the canvas fades in then. */
  protected readonly drawn = signal(false);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    afterRenderEffect((onCleanup) => {
      const loaded = this.scene();
      let renderer: SceneRenderer;
      try {
        renderer = new SceneRenderer(this.canvas().nativeElement, loaded);
      } catch (error) {
        console.warn('the background scene is not drawn:', error);
        return;
      }
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      const style = getComputedStyle(this.host);
      const parse = browserColourParser();
      let clock = 0;
      let last: number | undefined;
      let frame = 0;
      let onScreen = true;
      renderer.tints = readTints(style, parse); // as first shown: no fade

      /** Whether the tints the CSS sets changed: then the picture fades to them. */
      const retint = (): boolean => {
        const tints = readTints(style, parse);
        if (sameTints(tints, renderer.tints)) return false;
        renderer.fadingFrom = renderer.tints;
        renderer.tints = tints;
        renderer.fade = frame ? 0 : 1;
        return true;
      };

      const draw = () => {
        renderer.draw(clock);
        if (!this.drawn()) this.drawn.set(true);
      };
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        retint();
        const fading = renderer.fade < 1;
        if (!fading && last !== undefined && now - last < 1000 / this.maxFps() - FRAME_SLACK_MS)
          return;
        const step = last === undefined ? 0 : Math.min(MAX_STEP, (now - last) / 1000);
        clock += step;
        last = now;
        if (fading) renderer.fade = Math.min(1, renderer.fade + step / TINT_FADE_SECONDS);
        draw();
      };
      const play = () => {
        const animate = onScreen && !document.hidden && !reducedMotion.matches;
        if (animate && !frame) {
          last = undefined;
          frame = requestAnimationFrame(tick);
        } else if (!animate && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      };
      const resize = () => {
        const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
        renderer.resize(this.host.clientWidth * ratio, this.host.clientHeight * ratio);
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
      const checks = setInterval(() => {
        if (!frame && retint()) draw();
      }, TINT_CHECK_MS);
      resize();
      play();

      onCleanup(() => {
        cancelAnimationFrame(frame);
        clearInterval(checks);
        sized.disconnect();
        seen.disconnect();
        document.removeEventListener('visibilitychange', play);
        reducedMotion.removeEventListener('change', play);
        renderer.dispose();
      });
    });
  }
}
