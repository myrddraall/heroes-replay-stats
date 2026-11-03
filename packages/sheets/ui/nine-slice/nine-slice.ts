import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
  signal,
  untracked,
} from '@angular/core';
import {
  parseSheetName,
  planFrame,
  SHEET_PICTURES,
  sheetFrame,
  templateFrame,
  type FramePlan,
  type LoadedPicture,
  type PartPlan,
  type ResolvedFrame,
  type SliceFrame,
  type SliceState,
} from '../../model';

/** A frame: a sheet's frame by name (`validation#context-menu`), or one given in the template. */
export type SliceSource = string | SliceFrame;

type Place = 'back' | 'front';

/** A frame ready to draw, and the picture its pieces are cut from. */
interface Ready {
  readonly frame: ResolvedFrame;
  readonly plan: FramePlan;
  readonly picture: string;
}

/** One part as the template draws it: its fill and flip, and its pieces once they are cut. */
interface PartView {
  readonly size: string;
  readonly repeat: string;
  readonly scale: string | null;
  /** `url("…")` for each state the frame has a picture for. */
  readonly images: Readonly<Partial<Record<SliceState, string>>>;
}

/** One frame's layer as the template draws it. */
interface LayerView {
  readonly columns: string;
  readonly rows: string;
  readonly inset: string | null;
  readonly tint: string | null;
  readonly debug: boolean;
  readonly parts: readonly PartView[];
}

const px = (n: number) => `${n}px`;

/**
 * A layer's columns (or rows) from its corners' sizes: each corner its own size while there's
 * room, and once the element is smaller than both, the two share it in proportion (the corners
 * shrink together, the middle gone), so a frame fits any size.
 */
export function sliceTrack([start, end]: readonly [number, number]): string {
  const total = start + end;
  const corner = (n: number) => (total ? `min(${px(n)}, calc(100% * ${n / total}))` : '0px');
  return `${corner(start)} 1fr ${corner(end)}`;
}

/** How a part's pieces sit in its cell, for its fill. */
function fillStyle(plan: PartPlan): { size: string; repeat: string } {
  const [w, h] = plan.tile;
  const size = `${w === null ? '100%' : px(w)} ${h === null ? '100%' : px(h)}`;
  if (plan.fill === 'corner' || plan.fill === 'stretch') {
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
 * The element's content goes in a box over the frame's centre, padded in from its edges (the
 * frame in front's, or else the one behind's; a frame's `pad` turns that off or moves it), and
 * clipped there when it doesn't fit. The box lays its content out as the element would (its
 * display, alignment and gap). Each frame is a layer of nine parts (hidden from screen readers):
 * the one behind under the content, the one in front over it, letting clicks through. A frame
 * with states switches them with the element's (hover, pressed, focus, disabled, `aria-pressed` /
 * `aria-selected` for selected, or `sliceState`) in CSS, a missing one showing `normal`. Until its
 * picture loads the element shows without the frame.
 *
 * It is a component (its template holds the layers and the content box), so it can't go on an
 * element that is a component already; wrap that in an element of its own.
 */
@Component({
  // an attribute: it frames the element it's on (a div, a button), its content projected inside
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[hrsSlice], [hrsSliceBack], [hrsSliceFront]',
  imports: [NgTemplateOutlet],
  templateUrl: './nine-slice.html',
  styleUrl: './nine-slice.scss',
  host: {
    '[attr.data-hrs-slice-state]': 'sliceState() ?? null',
    '[style.padding]': 'padding()',
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

  private readonly store = inject(SHEET_PICTURES);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Each place's pieces once cut, part by part: state → `url("…")`. */
  private readonly pieces = signal<Partial<Record<Place, Partial<Record<SliceState, string>>[]>>>({});
  private generation = 0;

  /** Each place's frame as given or from the named set, and the picture it needs. */
  private readonly sources = computed(() => {
    const out: Partial<Record<Place, { source: SliceSource; url: string }>> = {};
    const named = (name: string) => ({
      source: name,
      url: this.store.sheetUrl(parseSheetName(name).sheet),
    });
    const set = this.hrsSlice();
    if (set) {
      const { sheet, entry } = parseSheetName(set);
      const status = this.store.status(this.store.sheetUrl(sheet));
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

  protected readonly back = computed(() => this.view('back'));
  protected readonly front = computed(() => this.view('front'));

  /**
   * The content's padding: the inner edge of the frame in front, or else of the one behind; a
   * frame's `pad: false` leaves it out, a number moves it that many pixels inward.
   */
  protected readonly padding = computed(() => {
    const { back, front } = this.ready();
    const padded = [front, back].find((r) => r && r.frame.pad !== false);
    if (!padded) return null;
    const extra = typeof padded.frame.pad === 'number' ? padded.frame.pad : 0;
    const { columns, rows } = padded.plan;
    return [rows[0], columns[1], rows[1], columns[0]].map((n) => px(n + extra)).join(' ');
  });

  constructor() {
    effect(() => {
      const urls = this.urls();
      untracked(() => urls.forEach((url) => this.store.load(url)));
    });
    effect(() => {
      const ready = this.ready();
      untracked(() => void this.cut(ready));
    });
    // the layers are placed over the element: it needs to be positioned (kept when it already
    // is), and a stacking context of its own keeps the one behind over its background
    const renderer = inject(Renderer2);
    renderer.setStyle(this.host, 'isolation', 'isolate');
    afterNextRender(() => {
      if (getComputedStyle(this.host).position === 'static') {
        renderer.setStyle(this.host, 'position', 'relative');
      }
    });
    inject(DestroyRef).onDestroy(() => this.generation++);
  }

  private resolve(source: SliceSource, picture: LoadedPicture): ResolvedFrame | null {
    if (typeof source !== 'string') return templateFrame(source, picture);
    const frame = picture.meta?.frames[parseSheetName(source).entry];
    return frame ? sheetFrame(frame) : null;
  }

  /** Cuts each part's pieces (every state) for each place, unless a newer frame came since. */
  private async cut(ready: Partial<Record<Place, Ready>>): Promise<void> {
    const generation = ++this.generation;
    const cut = async (r: Ready) =>
      Promise.all(
        r.plan.parts.map(async (plan) =>
          Object.fromEntries(
            await Promise.all(
              Object.entries(plan.cuts).map(
                async ([state, cut]) =>
                  [state, `url("${await this.store.piece(r.picture, cut!)}")`] as const,
              ),
            ),
          ),
        ),
      );
    const [back, front] = await Promise.all([
      ready.back ? cut(ready.back) : undefined,
      ready.front ? cut(ready.front) : undefined,
    ]);
    if (generation === this.generation) this.pieces.set({ back, front });
  }

  private view(place: Place): LayerView | null {
    const r = this.ready()[place];
    const pieces = this.pieces()[place];
    if (!r || !pieces) return null;
    const { frame, plan } = r;
    return {
      columns: sliceTrack(plan.columns),
      rows: sliceTrack(plan.rows),
      inset: frame.outset ? px(-frame.outset) : null,
      tint: frame.tint ?? null,
      debug: !!frame.debug,
      parts: plan.parts.map((part, i) => ({
        ...fillStyle(part),
        scale:
          part.flip === 'x' ? '-1 1' : part.flip === 'y' ? '1 -1' : part.flip === 'xy' ? '-1 -1' : null,
        images: pieces[i] ?? {},
      })),
    };
  }
}
