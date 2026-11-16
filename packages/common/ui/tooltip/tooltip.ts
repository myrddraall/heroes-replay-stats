import {
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  type ConnectedPosition,
  type OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  numberAttribute,
  type TemplateRef,
} from '@angular/core';
import { TooltipPanel } from './tooltip-panel';

/** Where a tooltip goes, against its element; the other side when there's no room. */
export type TooltipPosition = 'above' | 'below';

const BELOW: ConnectedPosition = { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 };
const ABOVE: ConnectedPosition = { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 };

let nextId = 0;

/**
 * A rich tooltip (`<span [hrsTooltip]="talentTip">`): a template, shown in the game's tooltip
 * after a moment's hover or on focus, gone on leaving, blurring or Escape, the element described
 * by it to screen readers while it shows. For text alone, Material's `matTooltip` (drawn the same).
 */
@Directive({
  selector: '[hrsTooltip]',
  exportAs: 'hrsTooltip',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()',
  },
})
export class Tooltip {
  readonly hrsTooltip = input.required<TemplateRef<unknown>>();
  readonly hrsTooltipPosition = input<TooltipPosition>('below');
  /** How long the pointer rests on the element before it shows, in milliseconds. */
  readonly hrsTooltipShowDelay = input(300, { transform: numberAttribute });

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly id = `hrs-tooltip-${nextId++}`;
  private overlay: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.hide();
      this.overlay?.dispose();
    });
  }

  /** Shows it, after the show delay. */
  show(): void {
    if (this.timer !== null || this.overlay?.hasAttached()) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.attach();
    }, this.hrsTooltipShowDelay());
  }

  hide(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.overlay?.hasAttached()) return;
    this.overlay.detach();
    this.element.removeAttribute('aria-describedby');
  }

  private attach(): void {
    const positions = this.hrsTooltipPosition() === 'above' ? [ABOVE, BELOW] : [BELOW, ABOVE];
    if (!this.overlay) {
      this.overlay = createOverlayRef(this.injector, {
        positionStrategy: createFlexibleConnectedPositionStrategy(this.injector, this.element)
          .withPositions(positions)
          .withFlexibleDimensions(false)
          .withViewportMargin(8),
        scrollStrategy: createRepositionScrollStrategy(this.injector),
      });
      // Escape while it shows, wherever the focus is (the topmost overlay's keys)
      this.overlay.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') this.hide();
      });
    }
    const panel = this.overlay.attach(new ComponentPortal(TooltipPanel, null, this.injector));
    panel.setInput('template', this.hrsTooltip());
    panel.setInput('panelId', this.id);
    this.element.setAttribute('aria-describedby', this.id);
  }
}
