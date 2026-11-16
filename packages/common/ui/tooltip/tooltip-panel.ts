import { NgTemplateOutlet } from '@angular/common';
import { Component, input, type TemplateRef } from '@angular/core';

/**
 * A rich tooltip's panel (`hrsTooltip` attaches it): its template in the game's tooltip (the
 * design system's `hrs-tooltip`, as Material's tooltips are drawn), described to screen readers by
 * its id. Never takes the pointer.
 */
@Component({
  selector: 'hrs-tooltip-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './tooltip-panel.html',
  styleUrl: './tooltip-panel.scss',
  host: { class: 'hrs-tooltip', role: 'tooltip', '[attr.id]': 'panelId()' },
})
export class TooltipPanel {
  readonly template = input.required<TemplateRef<unknown>>();
  readonly panelId = input.required<string>();
}
