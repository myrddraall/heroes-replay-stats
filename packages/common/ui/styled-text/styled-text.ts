import { Directive, input } from '@angular/core';

/** The game's display text treatments: the theme's colour, a bright core with a halo, or a gradient with a glow. */
export type StyledTextKind = 'base' | 'bright' | 'glow';

/**
 * Shows a few words or a number in one of the game's display treatments (the theme's StyledText:
 * `hrs-styled--base|bright|glow` in nexus.css): `<span hrsStyledText="glow">10</span>`. Its
 * colours come from the theme the element is in (`data-theme` on it or an ancestor), its size from
 * its font-size. Never for body copy.
 */
@Directive({
  selector: '[hrsStyledText]',
  host: {
    class: 'hrs-styled',
    '[class.hrs-styled--base]': "hrsStyledText() === 'base'",
    '[class.hrs-styled--bright]': "hrsStyledText() === 'bright'",
    '[class.hrs-styled--glow]': "hrsStyledText() === 'glow'",
  },
})
export class StyledText {
  readonly hrsStyledText = input.required<StyledTextKind>();
}
