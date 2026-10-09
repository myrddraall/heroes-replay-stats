import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { cellToMapPixel, mapPixelToCell, snappedBox, type ViewPoint } from '../../view/camera';
import { frameContext, LAYER_STYLE } from '../../viewer/canvas';
import {
  LAYER_DONE,
  type LayerFrame,
  type MapLayer,
  type MapLayerStatus,
} from '../../viewer/map-layer';
import { MapLayerPlacement } from '../../viewer/map-layer-placement';
import { MapRenderer } from '../../viewer/map-renderer';
import { MapViewerStore } from '../../viewer/map-viewer.store';
import { ElementImages } from './element-images';
import {
  pieceAt,
  piecesOf,
  standingMasks,
  type ElementPiece,
  type ElementShown,
} from './element-pieces';

/** The hovered element's glow. */
const GLOW_COLOUR = 'rgba(255, 236, 160, 0.95)';

/**
 * The elements render's structures and camps (PACK.md, Elements), drawn on the canvas it is placed
 * on, further north first, each in the state it is given (`states`, by key; off if missing). The
 * one under the pointer glows, and a click on one is reported (`elementClick`). Where a standing
 * neighbour stands in front of a standing structure, its mask erases that part. The cut-outs are
 * in the map layer's pixels; they are placed through the projection of the layer's rate.
 */
@Directive({
  selector: 'canvas[hrsMapElementsLayer]',
  hostDirectives: [{ directive: MapLayerPlacement, inputs: ['order', 'rate'] }],
  host: { style: LAYER_STYLE, 'aria-hidden': 'true', '[hidden]': '!visible()' },
})
export class MapElementsLayer implements MapLayer {
  /** What each structure and camp shows, by its key (`structure-<id>`, `camp-<camp>`). */
  readonly states = input<Readonly<Record<string, ElementShown>>>({});
  readonly visible = input(true);
  /** A structure or camp was clicked: its key. */
  readonly elementClick = output<string>();

  readonly element = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
  private readonly viewer = inject(MapViewerStore);
  private readonly renderer = inject(MapRenderer);
  private readonly place = inject(MapLayerPlacement);

  private readonly elements = computed(() => this.viewer.map()?.pack.data.elements ?? null);
  private readonly pieces = computed(() => {
    const elements = this.elements();
    return elements ? piecesOf(elements) : [];
  });
  /** The piece under the pointer, by key (UI state). */
  private readonly hovered = signal<string | null>(null);
  private images: ElementImages | null = null;

  constructor() {
    effect((onCleanup) => {
      const map = this.viewer.map();
      const pieces = this.pieces();
      this.hovered.set(null);
      if (!map || !pieces.length) return;
      const images = new ElementImages(map.assets, pieces, () => this.renderer.redraw());
      this.images = images;
      onCleanup(() => {
        images.dispose();
        this.images = null;
      });
    });
    effect(() => {
      this.visible();
      this.states();
      this.hovered();
      this.renderer.redraw();
    });
    effect((onCleanup) => onCleanup(this.renderer.register(this)));
  }

  placement() {
    return this.place.placement();
  }

  private stateOf(piece: ElementPiece): ElementShown {
    return this.states()[piece.key] ?? 'off';
  }

  /** The map layer the cut-outs are in, when it is the shown arena's. */
  private mapLayer(frame: LayerFrame) {
    const elements = this.elements();
    return elements && this.visible() && elements.layer === frame.arena.layer.id
      ? frame.arena.layer
      : null;
  }

  render(frame: LayerFrame): MapLayerStatus {
    const context = frameContext(this.element, frame.viewport);
    const layer = this.mapLayer(frame);
    const images = this.images;
    if (!layer || !images) return LAYER_DONE;
    const { projection, viewport } = frame;
    const hovered = this.hovered();
    const states = this.states();
    const isStanding = (id: number) => states[`structure-${id}`] === 'standing';
    for (const piece of this.pieces()) {
      const state = this.stateOf(piece);
      const cut = piece.states[state];
      if (!cut) continue;
      const masks = state === 'standing' ? standingMasks(cut, isStanding) : [];
      const picture = images.picture(cut, masks);
      if (!picture) continue;
      // On whole device pixels, as the map's tiles are: drawn between pixels it would be
      // resampled, and come out softer than the terrain under it.
      const [x, y, w, h] = cut.rect;
      const box = snappedBox(
        projection.toScreen(mapPixelToCell(layer, x, y)),
        projection.toScreen(mapPixelToCell(layer, x + w, y + h)),
        viewport.dpr,
      );
      if (piece.key === hovered) {
        // The glow: its own shape's shadow, soft and bright, drawn twice to strengthen it.
        context.save();
        context.shadowColor = GLOW_COLOUR;
        context.shadowBlur = Math.max(8, 14 * Math.sqrt(projection.scale));
        context.drawImage(picture, box.x, box.y, box.w, box.h);
        context.drawImage(picture, box.x, box.y, box.w, box.h);
        context.restore();
      }
      context.drawImage(picture, box.x, box.y, box.w, box.h);
    }
    return LAYER_DONE;
  }

  private pieceAt(frame: LayerFrame, point: ViewPoint): ElementPiece | null {
    const layer = this.mapLayer(frame);
    const images = this.images;
    const cell = frame.projection.toCell(point);
    if (!layer || !images || !cell) return null;
    const [px, py] = cellToMapPixel(layer, cell);
    // Found by its hit picture whatever it shows, so one turned off can be clicked back on.
    return pieceAt(this.pieces(), px, py, (cut) => images.hit(cut));
  }

  hover(frame: LayerFrame, point: ViewPoint | null): boolean {
    const piece = point ? this.pieceAt(frame, point) : null;
    this.hovered.set(piece?.key ?? null);
    return piece !== null;
  }

  click(frame: LayerFrame, point: ViewPoint): boolean {
    const piece = this.pieceAt(frame, point);
    if (!piece) return false;
    this.elementClick.emit(piece.key);
    return true;
  }
}
