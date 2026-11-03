import { Component } from '@angular/core';
import { Shell } from '@myrddraall/heroes-replay-stats-shell/feature';

/** The app: the shell, which frames the routed page (or leaves a page to fill the window, app.routes.ts). */
@Component({
  selector: 'hrs-root',
  imports: [Shell],
  template: '<hrs-shell />',
})
export class App {}
