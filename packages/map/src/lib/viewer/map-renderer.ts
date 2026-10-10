import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { projection, type ViewPoint } from '../view/camera';
import type { LayerFrame, MapFrame, MapLayer } from './map-layer';
import { MapViewerStore } from './map-viewer.store';

/**
 * The viewer's frame loop, one per viewer (provided by {@link MapViewer}): the layers register
 * with it, and it draws them all in one animation frame whenever the view or a layer changes,
 * stacked by their placement's order. It also hands the pointer to the layers, front to back.
 */
@Injectable()
export class MapRenderer {
  private readonly store = inject(MapViewerStore);
  private layers: MapLayer[] = [];
  private pending = 0;
  private frames = 0;

  /** The first view of the pack is fully drawn: every layer had all it needed, nothing fading. */
  readonly settled = signal(false);
  /** The pointer is over something a click acts on. */
  readonly overInteractive = signal(false);

  constructor() {
    effect(() => {
      this.store.map();
      this.settled.set(false);
    });
    effect(() => {
      this.store.view();
      this.redraw();
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.pending));
  }

  /** Adds a layer; returns how to remove it. */
  register(layer: MapLayer): () => void {
    this.layers = [...this.layers, layer];
    this.redraw();
    return () => {
      this.layers = this.layers.filter((l) => l !== layer);
      this.redraw();
    };
  }

  /** Draws a frame soon (once, however many times it's asked before then). */
  redraw(): void {
    if (!this.pending) this.pending = requestAnimationFrame(() => this.draw());
  }

  /** The pointer moved over the viewer (`null`: it left). */
  hover(point: ViewPoint | null): void {
    const frame = this.frame();
    if (!frame) return;
    let found = false;
    for (const layer of this.stacked().reverse()) {
      if (layer.hover?.(this.layerFrame(frame, layer), found ? null : point)) found = true;
    }
    this.overInteractive.set(found);
  }

  /** A click (a press that didn't move) on the viewer. */
  click(point: ViewPoint): void {
    const frame = this.frame();
    if (!frame) return;
    for (const layer of this.stacked().reverse()) {
      if (layer.click?.(this.layerFrame(frame, layer), point)) return;
    }
  }

  /** The layers back to front: by their order, then by their place in the page. */
  private stacked(): MapLayer[] {
    return [...this.layers].sort(
      (a, b) =>
        a.placement().order - b.placement().order ||
        (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
    );
  }

  private layerFrame(frame: MapFrame, layer: MapLayer): LayerFrame {
    const placement = layer.placement();
    const { camera, viewport, arena } = frame;
    return {
      ...frame,
      placement,
      projection: projection(camera, viewport, arena.layer.pxPerCell, placement.rate),
    };
  }

  private frame(): MapFrame | null {
    const view = this.store.view();
    return view && { ...view, number: this.frames, now: performance.now() };
  }

  private draw(): void {
    this.pending = 0;
    this.frames++;
    const frame = this.frame();
    if (!frame) return;
    let complete = true;
    let animating = false;
    for (const [rank, layer] of this.stacked().entries()) {
      const zIndex = String(rank);
      if (layer.element.style.zIndex !== zIndex) layer.element.style.zIndex = zIndex;
      const status = layer.render(this.layerFrame(frame, layer));
      complete &&= status.complete;
      animating ||= status.animating;
    }
    if (animating) this.redraw();
    if (complete && !animating && !this.settled()) this.settled.set(true);
  }
}
