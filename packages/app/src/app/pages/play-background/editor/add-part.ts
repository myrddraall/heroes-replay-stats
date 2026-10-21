import { Component, computed, input, output } from '@angular/core';
import type { CreatedShape } from '../../../scenes/play-background/created-overlays';
import type { PickChoice } from './pick-list';
import { SplitButton, type SplitOption } from './split-button';

/** The option that reuses one of the game data's parts. */
const EXISTING = 'existing';

/** Each shape a part may take, as offered to add: its name and icon. */
const SHAPES: Readonly<Record<CreatedShape, { readonly label: string; readonly icon: string }>> = {
  sphere: { label: 'Sphere', icon: 'circle' },
  ring: { label: 'Ring', icon: 'radio_button_unchecked' },
  tube: { label: 'Tube', icon: 'crop_portrait' },
  cone: { label: 'Cone', icon: 'change_history' },
  disc: { label: 'Disc', icon: 'album' },
  capsule: { label: 'Capsule', icon: 'pill' },
  plane: { label: 'Plane', icon: 'rectangle' },
  band: { label: 'Band', icon: 'panorama_horizontal' },
};

/**
 * The controls to add parts (presentational) to what is selected: a body, a sky, an overlay made
 * in the editor; in the section of its parts. One button for each new shape it may take (a
 * planet's: a sphere, a ring, a tube, a cone or a disc about the body; the sky's: a band) and for the game data's parts to
 * reuse (`existing`, picked from a flyout), its arrow choosing; and, where what was added here may
 * be (`savable`), a button to save it as an overlay.
 */
@Component({
  selector: 'hrs-add-part',
  imports: [SplitButton],
  templateUrl: './add-part.html',
  styleUrl: './properties-panel.scss',
})
export class AddPart {
  readonly shapes = input.required<readonly CreatedShape[]>();
  readonly existing = input<readonly PickChoice[]>([]);
  readonly savable = input(false);
  readonly added = output<CreatedShape>();
  readonly reused = output<string>();
  readonly saved = output<void>();
  protected readonly options = computed((): SplitOption[] => {
    const existing = this.existing();
    return [
      ...this.shapes().map((s) => ({ id: s, ...SHAPES[s] })),
      ...(existing.length
        ? [
            {
              id: EXISTING,
              label: 'Existing part',
              icon: 'category',
              pick: {
                title: 'Existing part',
                icon: 'category',
                // ("Surface · korhal": the part, and whose it is.)
                items: existing.map((o) => {
                  const [label = o.label, ...whose] = o.label.split(' · ');
                  return { id: o.value, label, caption: whose.join(' · ') };
                }),
              },
            },
          ]
        : []),
    ];
  });

  protected add(id: string): void {
    this.added.emit(id as CreatedShape);
  }

  protected reuse(picked: { readonly item: string }): void {
    this.reused.emit(picked.item);
  }
}
