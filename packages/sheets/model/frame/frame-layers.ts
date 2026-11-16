/** A frame layer's slot: behind the content, or over it. */
export type FrameSlot = 'back' | 'front';

/**
 * The states a layer is for, from its directive's value: a name, or several separated by commas
 * (`chosen, chosen-locked`); none (an empty value) makes it its slot's default.
 */
export function frameLayerStates(value: string | null | undefined): readonly string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Whether a layer shows: when it is for the frame's state, or when it is its slot's default and
 * no layer in the slot is for that state. A frame without a state shows its defaults.
 */
export function frameLayerShown(
  states: readonly string[],
  frameState: string | null,
  slotHasState: boolean,
): boolean {
  if (frameState !== null && states.includes(frameState)) return true;
  return states.length === 0 && (frameState === null || !slotHasState);
}
