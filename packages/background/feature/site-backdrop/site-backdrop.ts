import { Component } from '@angular/core';
// Not in Aether's root entry, which the app loads at once: the shell loads this component when idle.
import { SceneView } from '@myrddraall/heroes-replay-stats-aether/view';

/** The site's background behind every framed page: the Play screen scene, filling the window. */
@Component({
  selector: 'hrs-site-backdrop',
  imports: [SceneView],
  template: '<aether-scene-view />',
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    aether-scene-view {
      position: absolute;
      inset: 0;
    }
  `,
})
export class SiteBackdrop {}
