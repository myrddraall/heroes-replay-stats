import { Component, computed, Directive, input, signal, type Signal } from '@angular/core';
import { type FrameSlot } from '../../model';

/** A layer as its frame knows it: its slot and the states it is for. */
export interface FrameLayerEntry {
  readonly slot: FrameSlot;
  readonly states: Signal<readonly string[]>;
}

/**
 * A frame (`[hrsFrame]`, or the `hrs-frame` element): a container in three layers, a back, the
 * content (its midground) and a front. The layers are its children marked `hrsFrameBack` or
 * `hrsFrameFront` (any element: a sprite, a masked span, a 9-slice), drawn over its whole box
 * behind or over the content; everything else is the content. The content sets the size (1em, for
 * an icon, at the frame's `font-size`) and the frame is built around it: `--hrs-frame-inset` is
 * how far the frame's box reaches out from the content on each side, the layers filling that box.
 *
 * It is in one state at a time (`state`, any name, or none): each slot shows its layers for that
 * state, or its default (an unmarked layer) when it has none for it. It reflects the state as its
 * `state` attribute, so a page can style its content by it too. A frame component composes it as a
 * host directive, its layers in its template.
 */
@Directive({
  selector: '[hrsFrame]',
  host: {
    '[attr.state]': 'state() ?? null',
    style:
      'position: relative; isolation: isolate; box-sizing: border-box; padding: var(--hrs-frame-inset, 0)',
  },
})
export class Frame {
  readonly state = input<string | null>(null);

  private readonly layers = signal<readonly FrameLayerEntry[]>([]);

  /** Each slot's states that a layer is for. */
  private readonly statesBySlot = computed(() => {
    const by: Record<FrameSlot, Set<string>> = { back: new Set(), front: new Set() };
    for (const layer of this.layers()) for (const s of layer.states()) by[layer.slot].add(s);
    return by;
  });

  /** Whether a layer in `slot` is for `state`. */
  hasLayerFor(slot: FrameSlot, state: string): boolean {
    return this.statesBySlot()[slot].has(state);
  }

  /** A layer joins the frame (its directive, when created); the returned function leaves it. */
  register(layer: FrameLayerEntry): () => void {
    this.layers.update((layers) => [...layers, layer]);
    return () => this.layers.update((layers) => layers.filter((l) => l !== layer));
  }
}

/**
 * A frame as an element of its own (`<hrs-frame>`): its content centred, the frame around it
 * (`--hrs-frame-inset` out on each side).
 */
@Component({
  selector: 'hrs-frame',
  hostDirectives: [{ directive: Frame, inputs: ['state'] }],
  template: '<ng-content />',
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
    }
  `,
})
export class FrameElement {}
