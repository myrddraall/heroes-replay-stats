import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { LAYOUT_CONSTRAINTS } from './layout-constraints';

/** How a layout's constraints apply to a child placed in it. */
export type LayoutConstraint = 'constrained' | 'padded' | 'edge-to-edge';

/**
 * A page layout, one column: its children stacked, each constrained as its `hrsLayoutItem` says
 * (`constrained`: centred within the max width, padded; `padded`: the full width, padded;
 * `edge-to-edge`), or as the layout's `default` where a child says nothing. The constraints
 * (`LAYOUT_CONSTRAINTS`) are custom properties on the layout, `--hrs-layout-max-width` and
 * `--hrs-layout-padding`, which the layout's own width sets: the narrow padding below
 * `narrowBelow`. The styles are global (`layout.scss`, prefixed `hrs-layout`), since they style
 * the projected children.
 */
@Component({
  selector: 'hrs-layout',
  template: '<ng-content />',
  styleUrl: './layout.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'hrs-layout',
    '[class.hrs-layout--default-constrained]': "default() === 'constrained'",
    '[class.hrs-layout--default-padded]': "default() === 'padded'",
    '[class.hrs-layout--default-edge-to-edge]': "default() === 'edge-to-edge'",
    '[style.--hrs-layout-max-width.px]': 'constraints.maxWidth',
    '[style.--hrs-layout-padding.px]': 'padding()',
  },
})
export class Layout {
  /** How a child that says nothing is constrained. */
  readonly default = input<LayoutConstraint>('constrained');

  protected readonly constraints = inject(LAYOUT_CONSTRAINTS);
  /** The layout's width, once measured (null until then, and where the browser can't observe it). */
  private readonly width = signal<number | null>(null);
  protected readonly padding = computed(() => {
    const width = this.width();
    const { padding, narrowPadding, narrowBelow } = this.constraints;
    return width !== null && width < narrowBelow ? narrowPadding : padding;
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        if (entry) this.width.set(entry.contentRect.width);
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
