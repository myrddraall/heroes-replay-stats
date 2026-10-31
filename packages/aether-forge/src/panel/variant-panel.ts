import { Component, computed, inject } from '@angular/core';
import { Editor } from '../editing/editor';
import { VariantList } from '../variants/variant-list';
import { VariantProperties } from '../variants/variant-properties';

/**
 * The selected body's variants (container, on the `Editor` in effect): with their category
 * selected, what makes new ones and the list of them; one of them selected, its properties.
 */
@Component({
  selector: 'forge-variant-panel',
  imports: [VariantList, VariantProperties],
  templateUrl: './variant-panel.html',
  styleUrl: './body-panel.scss',
})
export class VariantPanel {
  protected readonly editor = inject(Editor);
  /** The variant selected, as listed. */
  protected readonly variant = computed(() => {
    const id = this.editor.selectedVariant();
    return id === null ? null : (this.editor.variantRows().find((v) => v.id === id) ?? null);
  });
}
