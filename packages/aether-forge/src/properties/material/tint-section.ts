import { Component, input, output } from '@angular/core';
import type { MaterialTint } from '@myrddraall/heroes-replay-stats-aether/formats';
import { NO_MATERIAL_TINT } from '@myrddraall/heroes-replay-stats-aether/materials';
import { BLEND_GROUPS, BLENDS, type TintBlend } from '@myrddraall/heroes-replay-stats-aether/tints';
import { PropertyColour } from '../../controls/rows/property-colour';
import { PropertySection } from '../../controls/property-section';
import { grouped, PropertySelect } from '../../controls/rows/property-select';
import { PropertyNumber } from '../../controls/rows/property-number';

/**
 * A tint's section of a properties panel (presentational), for whatever it tints (a material, a
 * body over all its materials, the sky as a whole): its colour, how it blends, how strongly. Each
 * part set here shows a reset that gives back what it would be (`base`); the section's gives back
 * the whole tint, and so does a part's once nothing else is set.
 */
@Component({
  selector: 'forge-tint-section',
  imports: [PropertySection, PropertyColour, PropertySelect, PropertyNumber],
  templateUrl: './tint-section.html',
})
export class TintSection {
  readonly title = input('Colour');
  /** The tint as shown. */
  readonly tint = input.required<MaterialTint>();
  /** What it would be where none is set here: its own, or none. */
  readonly base = input<MaterialTint>(NO_MATERIAL_TINT);
  /** The tint as set here, where it is. */
  readonly set = input<MaterialTint | undefined>(undefined);
  /** The tint changed: the whole of it, as it is to be set. */
  readonly tintChange = output<MaterialTint>();
  /** The tint taken back, so it is what it would be again. */
  readonly clear = output<void>();
  protected readonly blends = grouped(...BLEND_GROUPS);

  protected change(change: Partial<MaterialTint>): void {
    this.tintChange.emit({ ...this.tint(), ...change });
  }

  protected blend(blend: string): void {
    if (BLENDS.includes(blend as TintBlend)) this.change({ blend: blend as TintBlend });
  }

  /** Whether a part of it is set here, other than what it would be. */
  protected isSet(field: keyof MaterialTint): boolean {
    const set = this.set();
    return !!set && set[field] !== this.base()[field];
  }

  /** A part back to what it would be; the whole tint taken back once nothing else is set. */
  protected reset(field: keyof MaterialTint): void {
    const base = this.base();
    const tint = { ...this.tint(), [field]: base[field] };
    const same = (Object.keys(base) as (keyof MaterialTint)[]).every((k) => tint[k] === base[k]);
    if (same) this.clear.emit();
    else this.tintChange.emit(tint);
  }
}
