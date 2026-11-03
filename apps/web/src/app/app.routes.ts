import type { Routes } from '@angular/router';

/**
 * The app's own routes, after those its domains' featuresets add (listed before `provideRouter`):
 * the home page, the Game area's first section, and where an unknown URL goes. A route with
 * `data: { shell: false }` fills the window on its own.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'matches' },
  { path: 'game', pathMatch: 'full', redirectTo: 'game/maps' },
  { path: '**', redirectTo: 'matches' },
];
