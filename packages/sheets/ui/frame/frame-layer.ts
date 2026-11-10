import { computed, DestroyRef, Directive, inject, input, type Signal } from '@angular/core';
import { frameLayerShown, frameLayerStates, type FrameSlot } from '../../model';
import { Frame } from './frame';

/** Joins the nearest frame as a layer of `slot` and tells whether it shows, for its directive. */
function frameLayer(slot: FrameSlot, value: Signal<string | undefined>): Signal<boolean> {
  const frame = inject(Frame);
  const states = computed(() => frameLayerStates(value()));
  inject(DestroyRef).onDestroy(frame.register({ slot, states }));
  return computed(() => {
    const state = frame.state();
    return frameLayerShown(states(), state, state !== null && frame.hasLayerFor(slot, state));
  });
}

/** How a layer sits: over the frame's whole box, hidden from screen readers, letting clicks through. */
const LAYER_HOST = {
  'aria-hidden': 'true',
  style: 'position: absolute; inset: 0; pointer-events: none',
  '[style.display]': "shown() ? null : 'none'",
};

/**
 * Puts its element in its frame's back layer, behind the content: for the state(s) its value names
 * (`hrsFrameBack="locked"`, `"chosen, chosen-locked"`), or, with none, as the slot's default.
 */
@Directive({
  selector: '[hrsFrameBack]',
  host: { ...LAYER_HOST, '[style.z-index]': '-1' },
})
export class FrameBack {
  readonly hrsFrameBack = input<string>();
  protected readonly shown = frameLayer('back', this.hrsFrameBack);
}

/**
 * Puts its element in its frame's front layer, over the content: for the state(s) its value names,
 * or, with none, as the slot's default.
 */
@Directive({
  selector: '[hrsFrameFront]',
  host: { ...LAYER_HOST, '[style.z-index]': '1' },
})
export class FrameFront {
  readonly hrsFrameFront = input<string>();
  protected readonly shown = frameLayer('front', this.hrsFrameFront);
}
