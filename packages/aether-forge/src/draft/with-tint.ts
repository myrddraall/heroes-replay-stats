import { presetColour, TINT_PRESETS } from '@myrddraall/heroes-replay-stats-aether';
import { type Design } from '@myrddraall/heroes-replay-stats-aether/design';
import { type PartTint, UNTINTED } from '@myrddraall/heroes-replay-stats-aether/tints';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { signalStoreFeature, type, withMethods, withProps } from '@ngrx/signals';
import { designWrites } from './design-writes';

/** The global tint's choice that is set by hand. */
export const CUSTOM_TINT = 'custom';

/** The colour over the whole picture: a preset (its colour read from the theme), or one set by hand. */
export function withTint() {
  return signalStoreFeature(
    { state: type<Design>() },
    withProps(() => ({
      _root: inject(DOCUMENT).documentElement,
      _tintPresets: inject(TINT_PRESETS),
    })),
    withMethods((store) => {
      const { setScenes } = designWrites(store);
      return {
        /**
         * The colour chosen: a preset by id (the first: none, its colour read from the theme), or
         * Custom, which starts from the tint there is and is set by hand.
         */
        chooseTint(choice: string): void {
          if (choice === CUSTOM_TINT) {
            setScenes((s) => ({
              ...s,
              settings: { choice, background: { ...s.settings.background, on: true } },
            }));
            return;
          }
          const preset = store._tintPresets.find((p) => p.id === choice);
          if (!preset) return;
          const colour = presetColour(preset, store._root);
          setScenes((s) => ({
            ...s,
            settings: {
              choice,
              background: { on: preset.token !== null, colour, blend: preset.blend },
            },
          }));
        },
        setTint(change: Partial<PartTint>): void {
          setScenes((s) => ({
            ...s,
            settings: { ...s.settings, background: { ...s.settings.background, ...change } },
          }));
        },
        resetTint(): void {
          setScenes((s) => ({ ...s, settings: UNTINTED }));
        },
      };
    }),
  );
}
