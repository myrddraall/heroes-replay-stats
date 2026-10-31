import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import {
  distanceAhead,
  dolly,
  fieldOfView,
  orbit,
  orbitAround,
  pan,
} from '@myrddraall/heroes-replay-stats-aether/camera';
import { SCENE_CENTRE } from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { SceneCamera, SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
/** How far a press must move before it is a drag (not a click that picks a planet), in pixels. */
const DRAG_FROM = 4;
/** Degrees the camera orbits per pixel dragged. */
const ORBIT_SPEED = 0.25;

/**
 * Moves a scene's camera by dragging and scrolling over the view it is on (`camera`: the camera
 * now, none: nothing to move): a drag orbits round what the view is about (`about`: a planet open,
 * kept where it is in the view; none: what it looks at, the scene's middle as far ahead), Shift
 * (or the right or middle button) pans across, the wheel moves in and out, Alt with the wheel
 * widens or narrows its field of view. Each move is given (`cameraMove`); a drag is not a click.
 */
@Directive({
  selector: '[forgeCameraDrag]',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'up($event)',
    '(wheel)': 'wheel($event)',
    '(contextmenu)': 'menu($event)',
  },
})
export class CameraDrag {
  readonly camera = input<SceneCamera | null>(null, { alias: 'forgeCameraDrag' });
  readonly about = input<Vec3 | null>(null, { alias: 'forgeCameraDragAbout' });
  readonly cameraMove = output<SceneCameraSet>();
  /** A drag begun and ended (what it moves taken as one change between). */
  readonly cameraMoveStart = output<void>();
  readonly cameraMoveEnd = output<void>();
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private press?: {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly panning: boolean;
    readonly from: SceneCamera;
    readonly distance: number;
    dragging: boolean;
  };
  /** Whether the last press was a drag (its click is then not a pick). */
  private dragged = false;

  constructor() {
    // A drag's click is kept from the view under it (caught on the way down to it).
    const swallow = (event: MouseEvent) => {
      if (!this.dragged) return;
      this.dragged = false;
      event.stopPropagation();
      event.preventDefault();
    };
    afterNextRender(() => this.host.addEventListener('click', swallow, true));
    inject(DestroyRef).onDestroy(() => this.host.removeEventListener('click', swallow, true));
  }

  protected down(event: PointerEvent): void {
    const camera = this.camera();
    if (!camera || (event.target as HTMLElement).closest('button, input, select, a')) return;
    this.dragged = false;
    this.press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panning: event.shiftKey || event.button === 1 || event.button === 2,
      from: camera,
      distance: distanceAhead(camera, this.about() ?? SCENE_CENTRE.position, 5),
      dragging: false,
    };
  }

  protected move(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < DRAG_FROM) return;
      press.dragging = true;
      this.cameraMoveStart.emit();
      try {
        this.host.setPointerCapture(event.pointerId);
      } catch {
        // a pointer no longer down: the drag goes on while it moves over the view
      }
    }
    if (press.panning) {
      // The scene under the pointer kept under it: as far across as the view shows at that distance.
      const height = this.host.clientHeight || 1;
      const unit = (2 * press.distance * Math.tan((press.from.fovY * Math.PI) / 360)) / height;
      this.cameraMove.emit(pan(press.from, -dx * unit, dy * unit));
    } else {
      const about = this.about();
      this.cameraMove.emit(
        about
          ? orbitAround(press.from, about, -dx * ORBIT_SPEED, dy * ORBIT_SPEED)
          : orbit(press.from, press.distance, -dx * ORBIT_SPEED, dy * ORBIT_SPEED),
      );
    }
  }

  protected up(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.id) return;
    this.dragged = press.dragging;
    this.press = undefined;
    if (press.dragging) this.cameraMoveEnd.emit();
    if (this.host.hasPointerCapture(event.pointerId))
      this.host.releasePointerCapture(event.pointerId);
  }

  protected wheel(event: WheelEvent): void {
    const camera = this.camera();
    if (!camera || (event.target as HTMLElement).closest('button, input, select, a')) return;
    event.preventDefault();
    if (event.altKey) {
      this.cameraMove.emit({ fovY: fieldOfView(camera.fovY * Math.exp(event.deltaY * 0.001)) });
      return;
    }
    const distance = distanceAhead(camera, this.about() ?? SCENE_CENTRE.position, 5);
    this.cameraMove.emit(dolly(camera, distance, -event.deltaY * distance * 0.001));
  }

  /** No menu over the view where the right button pans. */
  protected menu(event: MouseEvent): void {
    if (this.camera()) event.preventDefault();
  }
}
