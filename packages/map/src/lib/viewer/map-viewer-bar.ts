import { Directive, inject, TemplateRef } from '@angular/core';

/** Which edge of the viewer a bar is along. */
export type BarSide = 'left' | 'right' | 'top' | 'bottom';

/** What a bar's template is given: its side. */
export interface BarContext {
  readonly $implicit: BarSide;
}

/**
 * A template for the viewer's bars, placed inside `hrs-map-viewer`: rendered in each bar, filling
 * it, with the bar's side (`let-side`) to tell them apart. Without one, the bars are plain
 * (`--hrs-map-viewer-bars`).
 */
@Directive({ selector: 'ng-template[hrsMapViewerBar]' })
export class MapViewerBar {
  readonly template = inject<TemplateRef<BarContext>>(TemplateRef);
}
