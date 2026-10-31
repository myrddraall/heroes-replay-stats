import { computed, Directive, inject, input } from '@angular/core';
import { Layout, type LayoutConstraint } from './layout';

/**
 * How a child of a layout (`hrs-layout`) is constrained: `hrsLayoutItem="edge-to-edge"`,
 * `"padded"` or `"constrained"`; empty, the layout's default. A child without the directive gets
 * the layout's default too.
 */
@Directive({
  selector: '[hrsLayoutItem]',
  host: {
    class: 'hrs-layout-item',
    '[class.hrs-layout-item--constrained]': "constraint() === 'constrained'",
    '[class.hrs-layout-item--padded]': "constraint() === 'padded'",
    '[class.hrs-layout-item--edge-to-edge]': "constraint() === 'edge-to-edge'",
  },
})
export class LayoutItem {
  readonly hrsLayoutItem = input<LayoutConstraint | ''>('');

  private readonly layout = inject(Layout, { optional: true });
  protected readonly constraint = computed(
    (): LayoutConstraint => this.hrsLayoutItem() || this.layout?.default() || 'constrained',
  );
}
