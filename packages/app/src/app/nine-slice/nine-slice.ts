import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
  RendererStyleFlags2,
  untracked,
} from '@angular/core';
import { SLICE_PARTS } from '../sheet/read-sheet';
import { parseSheetName, SheetStore, type LoadedPicture } from '../sheet/sheet.store';
import {
  planFrame,
  sheetFrame,
  templateFrame,
  type FramePlan,
  type PartPlan,
  type ResolvedFrame,
  type SliceFrame,
  type SliceState,
} from './slice-frame';

/** A frame: a sheet's frame by name (`validation#context-menu`), or one given in the template. */
export type SliceSource = string | SliceFrame;

type Place = 'back' | 'front';

/** A frame ready to draw, and the picture its pieces are cut from. */
interface Ready {
  readonly frame: ResolvedFrame;
  readonly plan: FramePlan;
  readonly picture: string;
}

const px = (n: number) => `${n}px`;
const flags = RendererStyleFlags2.DashCase;

/** How a part's pieces sit in its cell, for its fill. */
function fillStyle(plan: PartPlan): { size: string; repeat: string } {
  const [w, h] = plan.tile;
  const size = `${w === null ? '100%' : px(w)} ${h === null ? '100%' : px(h)}`;
  if (plan.fill === 'corner' || plan.fill === 'stretch' || plan.fill === 'none') {
    return { size: '100% 100%', repeat: 'no-repeat' };
  }
  const mode = plan.fill === 'tile' ? 'repeat' : plan.fill;
  const repeat =
    plan.part === 'centre'
      ? mode
      : plan.part === 'top' || plan.part === 'bottom'
        ? `${mode} no-repeat`
        : `no-repeat ${mode}`;
  return { size, repeat };
}

/**
 * Frames an element with resizable art (9-slice): four cuts make a 3×3 grid of the picture, the
 * corners keep their size, the sides and centre stretch or tile to fill. One frame behind the
 * content and one over it: `<div [hrsSliceBack]="panel" [hrsSliceFront]="border">`, either one
 * alone, or a sheet's set of both by name, `<button hrsSlice="validation#topnav-button">`. A frame
 * is a sheet's by name (`sheet#frame`, the sheet's metadata saying how it slices) or a
 * `SliceFrame` object.
 *
 * Each frame is a layer of nine parts inside the element (hidden from screen readers): the one
 * behind under the content, the one in front over it, letting clicks through. A frame with states
 * switches them with the element's (hover, pressed, focus, disabled, `aria-pressed` /
 * `aria-selected` for selected, or `sliceState`) in CSS (nine-slice.scss), a missing one showing
 * `normal`. Until its picture loads the element shows without the frame.
 */
@Directive({
  selector: '[hrsSlice], [hrsSliceBack], [hrsSliceFront]',
  host: {
    'data-hrs-slice': '',
    '[attr.data-hrs-slice-state]': 'sliceState() ?? null',
    '[style.isolation]': '"isolate"',
    '[style.padding]': 'padding()',
    '[style.min-width]': 'minSize()?.width ?? null',
    '[style.min-height]': 'minSize()?.height ?? null',
  },
})
export class NineSlice {
  /** A sheet's set by name (`sheet#set`): its frame behind, in front, or both. */
  readonly hrsSlice = input<string>();
  /** The frame behind the content (over the element's own background). */
  readonly hrsSliceBack = input<SliceSource>();
  /** The frame over the content. */
  readonly hrsSliceFront = input<SliceSource>();
  /** A state the CSS can't see (a toggle the page keeps): shown as the element's own would be. */
  readonly sliceState = input<SliceState>();

  private readonly store = inject(SheetStore);
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly layers = new Map<Place, { layer: HTMLElement; parts: HTMLElement[] }>();
  private generation = 0;

  /** Each place's frame as given or from the named set, and the picture it needs. */
  private readonly sources = computed(() => {
    const out: Partial<Record<Place, { source: SliceSource; url: string }>> = {};
    const named = (name: string) => ({ source: name, url: this.store.sheetUrl(parseSheetName(name).sheet) });
    const set = this.hrsSlice();
    if (set) {
      const { sheet, entry } = parseSheetName(set);
      const url = this.store.sheetUrl(sheet);
      const status = this.store.status(url);
      const pair = status?.status === 'ready' ? status.picture.meta?.sets[entry] : undefined;
      if (pair?.back) out.back = named(`${sheet}#${pair.back}`);
      if (pair?.front) out.front = named(`${sheet}#${pair.front}`);
    }
    for (const [place, source] of [
      ['back', this.hrsSliceBack()],
      ['front', this.hrsSliceFront()],
    ] as const) {
      if (!source) continue;
      out[place] = typeof source === 'string' ? named(source) : { source, url: source.picture.src };
    }
    return out;
  });

  /** The pictures to load: the named set's sheet first (it says what the frames are), then each frame's. */
  private readonly urls = computed(
    () => {
      const set = this.hrsSlice();
      const urls = new Set<string>();
      if (set) urls.add(this.store.sheetUrl(parseSheetName(set).sheet));
      for (const s of Object.values(this.sources())) urls.add(s.url);
      return [...urls];
    },
    { equal: (a, b) => a.length === b.length && a.every((url, i) => url === b[i]) },
  );

  /** Each place's frame, once its picture is loaded. */
  private readonly ready = computed(() => {
    const out: Partial<Record<Place, Ready>> = {};
    for (const [place, { source, url }] of Object.entries(this.sources()) as [
      Place,
      { source: SliceSource; url: string },
    ][]) {
      const status = this.store.status(url);
      if (status?.status !== 'ready') continue;
      const frame = this.resolve(source, status.picture);
      if (frame) out[place] = { frame, plan: planFrame(frame), picture: url };
    }
    return out;
  });

  /** Pads the content to the inner area of the frame in front (or behind, when it asks). */
  protected readonly padding = computed(() => {
    const { back, front } = this.ready();
    const padded = front && front.frame.pad !== false ? front : back?.frame.pad ? back : null;
    if (!padded) return null;
    const { columns, rows } = padded.plan;
    return `${px(rows[0])} ${px(columns[1])} ${px(rows[1])} ${px(columns[0])}`;
  });

  /** Never smaller than the frames' corners. */
  protected readonly minSize = computed(() => {
    const plans = Object.values(this.ready()).map((r) => r.plan);
    if (!plans.length) return null;
    return {
      width: px(Math.max(...plans.map((p) => p.columns[0] + p.columns[1]))),
      height: px(Math.max(...plans.map((p) => p.rows[0] + p.rows[1]))),
    };
  });

  constructor() {
    effect(() => {
      const urls = this.urls();
      untracked(() => urls.forEach((url) => this.store.load(url)));
    });
    effect(() => {
      const ready = this.ready();
      untracked(() => this.draw(ready));
    });
    // a frame is drawn inside the element: it needs to be positioned (kept when it already is)
    afterNextRender(() => {
      if (getComputedStyle(this.host).position === 'static') {
        this.renderer.setStyle(this.host, 'position', 'relative');
      }
    });
    inject(DestroyRef).onDestroy(() => this.generation++);
  }

  private resolve(source: SliceSource, picture: LoadedPicture): ResolvedFrame | null {
    if (typeof source !== 'string') return templateFrame(source, picture);
    const frame = picture.meta?.frames[parseSheetName(source).entry];
    return frame ? sheetFrame(frame) : null;
  }

  /** Builds or updates each place's layer, then fills its parts once their pieces are cut. */
  private draw(ready: Partial<Record<Place, Ready>>): void {
    const generation = ++this.generation;
    for (const place of ['back', 'front'] as const) {
      const r = ready[place];
      if (!r) {
        this.remove(place);
        continue;
      }
      const { layer, parts } = this.layer(place);
      const { frame, plan } = r;
      const set = (el: HTMLElement, name: string, value: string | null) =>
        value === null
          ? this.renderer.removeStyle(el, name, flags)
          : this.renderer.setStyle(el, name, value, flags);
      set(layer, 'grid-template-columns', `${px(plan.columns[0])} 1fr ${px(plan.columns[1])}`);
      set(layer, 'grid-template-rows', `${px(plan.rows[0])} 1fr ${px(plan.rows[1])}`);
      set(layer, 'inset', frame.outset ? px(-frame.outset) : null);
      set(layer, '--hrs-slice-tint', frame.tint ?? null);
      this.toggle(layer, 'hrs-slice--tint', !!frame.tint);
      this.toggle(layer, 'hrs-slice--debug', !!frame.debug);
      plan.parts.forEach((partPlan, i) => {
        const el = parts[i]!;
        const { size, repeat } = fillStyle(partPlan);
        set(el, '--hrs-slice-size', size);
        set(el, '--hrs-slice-repeat', repeat);
        set(el, 'scale', partPlan.flip === 'x' ? '-1 1' : partPlan.flip === 'y' ? '1 -1' : partPlan.flip === 'xy' ? '-1 -1' : null);
        this.toggle(el, 'hrs-slice__part--empty', partPlan.fill === 'none');
      });
      void this.fill(r, parts, generation);
    }
  }

  /** Cuts each part's pieces (every state) and hands them to the CSS, unless a newer draw started. */
  private async fill(ready: Ready, parts: HTMLElement[], generation: number): Promise<void> {
    const urls = await Promise.all(
      ready.plan.parts.map(async (plan) =>
        Promise.all(
          Object.entries(plan.cuts).map(
            async ([state, cut]) => [state, await this.store.piece(ready.picture, cut!)] as const,
          ),
        ),
      ),
    );
    if (generation !== this.generation) return;
    urls.forEach((states, i) => {
      for (const state of ['normal', 'selected', 'focus', 'hover', 'pressed', 'disabled']) {
        this.renderer.removeStyle(parts[i]!, `--hrs-slice-${state}`, flags);
      }
      for (const [state, url] of states) {
        this.renderer.setStyle(parts[i]!, `--hrs-slice-${state}`, `url("${url}")`, flags);
      }
    });
  }

  private layer(place: Place): { layer: HTMLElement; parts: HTMLElement[] } {
    let found = this.layers.get(place);
    if (!found) {
      const layer: HTMLElement = this.renderer.createElement('span');
      this.renderer.addClass(layer, 'hrs-slice');
      this.renderer.addClass(layer, `hrs-slice--${place}`);
      this.renderer.setAttribute(layer, 'aria-hidden', 'true');
      const parts = SLICE_PARTS.map((part) => {
        const el: HTMLElement = this.renderer.createElement('span');
        this.renderer.addClass(el, 'hrs-slice__part');
        this.renderer.addClass(el, `hrs-slice__part--${part}`);
        this.renderer.appendChild(layer, el);
        return el;
      });
      // the frame behind goes first, the one in front last, around the element's content
      if (place === 'back') this.renderer.insertBefore(this.host, layer, this.host.firstChild);
      else this.renderer.appendChild(this.host, layer);
      found = { layer, parts };
      this.layers.set(place, found);
    }
    return found;
  }

  private remove(place: Place): void {
    const found = this.layers.get(place);
    if (!found) return;
    this.renderer.removeChild(this.host, found.layer);
    this.layers.delete(place);
  }

  private toggle(el: HTMLElement, name: string, on: boolean): void {
    if (on) this.renderer.addClass(el, name);
    else this.renderer.removeClass(el, name);
  }
}
