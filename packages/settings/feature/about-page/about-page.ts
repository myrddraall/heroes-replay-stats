import { Component } from '@angular/core';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { injectPlatform } from '@myrddraall/heroes-replay-stats-platform/data';
import { About } from '../../ui';

/** The About page (container): what the app is and its legal notices, with its version and what it runs as from the platform. */
@Component({
  selector: 'hrs-about-page',
  imports: [About, Layout],
  // the heading and its panel one item of the layout, as the Settings page's
  template: `<hrs-layout>
    <div>
      <h1>About</h1>
      <hrs-about [version]="platform.version" [kind]="platform.kind" />
    </div>
  </hrs-layout>`,
})
export class AboutPage {
  protected readonly platform = injectPlatform();
}
