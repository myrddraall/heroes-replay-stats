import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { reportFrameStats } from './platform/frame-stats-reports';

/** The routed page: the shell around the app's pages, or a page of its own (app.routes.ts). */
@Component({
  selector: 'hrs-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    // (Where dev reports go: the background's frame stats while they show, on any page.)
    reportFrameStats();
  }
}
