import { Component, inject, Injector, runInInjectionContext } from '@angular/core';
import { Shell } from '@myrddraall/heroes-replay-stats-shell/feature';
import { DEV_REPORTS_URL } from '@myrddraall/heroes-replay-stats-platform/data';

/** The app: the shell, which frames the routed page (or leaves a page to fill the window, app.routes.ts). */
@Component({
  selector: 'hrs-root',
  imports: [Shell],
  template: '<hrs-shell />',
})
export class App {
  constructor() {
    // Where dev reports go: the background's frame stats while they show, on any page. Loaded
    // only then: the stats come with the background's renderer, which the first page doesn't wait
    // for.
    if (inject(DEV_REPORTS_URL)) {
      const injector = inject(Injector);
      void import('./site-background/frame-stats-reports').then((m) =>
        runInInjectionContext(injector, m.reportFrameStats),
      );
    }
  }
}
