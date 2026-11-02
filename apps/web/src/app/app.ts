import { Component, inject, Injector, runInInjectionContext } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DEV_REPORTS_URL } from '@myrddraall/heroes-replay-stats-platform/data';

/** The routed page: the shell around the app's pages, or a page of its own (app.routes.ts). */
@Component({
  selector: 'hrs-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
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
