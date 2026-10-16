import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** The routed page: the shell around the app's pages, or a page of its own (app.routes.ts). */
@Component({
  selector: 'hrs-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
