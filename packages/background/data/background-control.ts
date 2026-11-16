import { inject, Service } from '@angular/core';
import { type Release, ViewStore } from '@myrddraall/heroes-replay-stats-aether';

export type { Release };

/** A page's own tints over the site's, as Aether's view takes them. */
export type PageTints = Parameters<InstanceType<typeof ViewStore>['setPageTints']>[0];

/**
 * What the rest of the app may ask of the site's background (Aether's view): to be held back while
 * something interactive has the page, and a page's own tints over the site's.
 */
@Service()
export class BackgroundControl {
  private readonly view = inject(ViewStore);

  /** The background draws at the interacting frame rate until the release returned is called. */
  requestInteracting(): Release {
    return this.view.requestInteracting();
  }

  /** A page's tints over the site's, until set back to null. */
  setPageTints(tints: PageTints): void {
    this.view.setPageTints(tints);
  }
}
