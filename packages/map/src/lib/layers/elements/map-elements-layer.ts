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
import {
  cellToMapPixel,
  mapPixelToCell,
  snappedBox,
  type ScreenBox,
  type ViewPoint,
} from '../../view/camera';
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
import type { ElementCut } from '../../pack/map-pack';
import { ElementImages, type ElementLevel, type ElementPicture } from './element-images';
import {
  drawOrder,
  pieceAt,
  piecesOf,
  standingMasks,
  type ElementPiece,
  type ElementShown,
} from './element-pieces';

/** The hovered element's glow. */
const GLOW_COLOUR = 'rgba(255, 236, 160, 0.95)';
/** The fade from one level of detail to the other, in milliseconds (as the tiles'). */
const FADE_MS = 250;
/** The full level is drawn once the small one would be stretched past this. */
const SMALL_STRETCH = 2;

/** A glow made for the hovered element: its canvas, and where it goes in the viewer. */
interface Glow {
  readonly canvas: OffscreenCanvas;
  readonly pad: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The elements render's structures and camps (PACK.md, Elements), drawn on the canvas it is placed
 * on, the rubble first and then the rest, each further north first, each in the state it is given (`states`, by key; off if missing). The
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
  /** The level of detail drawn last, and since when (for the fade to it). */
  private shown: { level: ElementLevel; since: number } | null = null;

  constructor() {
    effect((onCleanup) => {
      const map = this.viewer.map();
      const pieces = this.pieces();
      this.hovered.set(null);
      if (!map || !pieces.length) return;
      const elements = this.elements();
      if (!elements) return;
      const images = new ElementImages(map.assets, elements, () => this.renderer.redraw());
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
    const order = drawOrder(this.pieces(), (p) => this.stateOf(p));
    // The level of detail: the small one until it would be stretched too far, then the full one,
    // asked for as soon as it is wanted and drawn once it has arrived, faded in over the small.
    const wantFull = projection.scale > SMALL_STRETCH * images.smallScale;
    if (wantFull) images.wantFull(order.some((p) => this.stateOf(p) === 'rubble'));
    const level: ElementLevel = wantFull && images.has('full') ? 'full' : 'small';
    if (this.shown?.level !== level) this.shown = { level, since: frame.now };
    const fading =
      level === 'full' && frame.now - this.shown.since < FADE_MS && images.has('small');
    // On whole device pixels, as the map's tiles are: drawn between pixels it would be
    // resampled, and come out softer than the terrain under it.
    const boxOf = ([x, y, w, h]: ElementCut['rect']) =>
      snappedBox(
        projection.toScreen(mapPixelToCell(layer, x, y)),
        projection.toScreen(mapPixelToCell(layer, x + w, y + h)),
        viewport.dpr,
      );
    const pictures = (at: ElementLevel) => {
      const drawn: { piece: ElementPiece; picture: ElementPicture; box: ScreenBox }[] = [];
      for (const piece of order) {
        const state = this.stateOf(piece);
        const cut = piece.states[state];
        if (!cut) continue;
        const masks = state === 'standing' && at === 'full' ? standingMasks(cut, isStanding) : [];
        // At the full level a cut-out whose atlas hasn't arrived (the rubble's) is drawn small.
        const picture = images.picture(cut, masks, at) ?? images.picture(cut, [], 'small');
        if (picture) drawn.push({ piece, picture, box: boxOf(cut.rect) });
      }
      return drawn;
    };
    const draw = (drawn: ReturnType<typeof pictures>, alpha: number) => {
      context.globalAlpha = alpha;
      for (const { picture: p, box } of drawn) {
        context.drawImage(p.source, p.x, p.y, p.w, p.h, box.x, box.y, box.w, box.h);
      }
      context.globalAlpha = 1;
    };
    const drawn = pictures(level);
    // The hovered one's glow under everything: drawn with it, the neighbours drawn after it covered
    // the glow except where their masks let it show, in the masks' jagged shapes. One turned off
    // glows in the shape it has when it stands (its hit cut), with nothing drawn in it.
    const lit =
      drawn.find((d) => d.piece.key === hovered) ?? this.offGlow(order, hovered, level, boxOf);
    if (lit) {
      const blur = Math.max(8, 14 * Math.sqrt(projection.scale));
      const glow = this.glow(lit.picture, lit.box, blur, viewport.dpr);
      context.drawImage(glow.canvas, glow.x, glow.y, glow.w, glow.h);
    }
    if (fading) {
      draw(pictures('small'), 1);
      draw(drawn, Math.max(0, (frame.now - this.shown.since) / FADE_MS));
    } else {
      draw(drawn, 1);
    }
    return { complete: images.ready(wantFull ? 'full' : 'small'), animating: fading };
  }

  /** The hovered piece's standing picture, unmasked, where it stands, when it is turned off. */
  private offGlow(
    order: readonly ElementPiece[],
    hovered: string | null,
    level: ElementLevel,
    boxOf: (rect: ElementCut['rect']) => ScreenBox,
  ) {
    const piece = order.find((p) => p.key === hovered);
    const cut = piece && this.stateOf(piece) === 'off' ? piece.hit : null;
    const picture = cut && this.images?.picture(cut, [], level);
    return cut && picture ? { picture, box: boxOf(cut.rect) } : null;
  }

  /** The last glow made, kept while the same picture is hovered at the same size. */
  private glowKept: { key: unknown[]; glow: Glow } | null = null;

  /**
   * A picture's glow alone (its own shape's shadow, soft and bright, drawn twice to strengthen it,
   * with the shape itself taken out), as big as the picture's box with room for the blur round it.
   */
  private glow(picture: ElementPicture, box: ScreenBox, blur: number, dpr: number): Glow {
    const key = [picture.source, picture.x, picture.y, box.w, box.h, blur, dpr];
    const kept = this.glowKept;
    if (kept && kept.key.every((v, k) => v === key[k]))
      return { ...kept.glow, x: box.x - kept.glow.pad, y: box.y - kept.glow.pad };
    const pad = Math.ceil(blur * 2);
    const canvas = new OffscreenCanvas(
      Math.ceil((box.w + 2 * pad) * dpr),
      Math.ceil((box.h + 2 * pad) * dpr),
    );
    const g = canvas.getContext('2d');
    if (!g) throw new Error('This browser has no 2D canvas');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shape = () =>
      g.drawImage(
        picture.source,
        picture.x,
        picture.y,
        picture.w,
        picture.h,
        pad,
        pad,
        box.w,
        box.h,
      );
    g.shadowColor = GLOW_COLOUR;
    g.shadowBlur = blur;
    shape();
    shape();
    g.shadowColor = 'transparent';
    g.globalCompositeOperation = 'destination-out';
    shape();
    const glow = {
      canvas,
      pad,
      x: box.x - pad,
      y: box.y - pad,
      w: box.w + 2 * pad,
      h: box.h + 2 * pad,
    };
    this.glowKept = { key, glow };
    return glow;
  }

  private pieceAt(frame: LayerFrame, point: ViewPoint): ElementPiece | null {
    const layer = this.mapLayer(frame);
    const images = this.images;
    const cell = frame.projection.toCell(point);
    if (!layer || !images || !cell) return null;
    const [px, py] = cellToMapPixel(layer, cell);
    // Found by its hit picture whatever it shows, so one turned off can be clicked back on.
    return pieceAt(
      drawOrder(this.pieces(), (p) => this.stateOf(p)),
      px,
      py,
      (cut) => images.hit(cut),
    );
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
