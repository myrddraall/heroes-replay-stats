import type { Routes } from '@angular/router';

/**
 * The app's own routes, after those its domains' featuresets add (listed before `provideRouter`):
 * the home page, each area's first section, and where an unknown URL goes. A route with
 * `data: { shell: false }` fills the window on its own.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'replays/matches' },
  { path: 'replays', pathMatch: 'full', redirectTo: 'replays/matches' },
  { path: 'game-info', pathMatch: 'full', redirectTo: 'game-info/maps' },
  // where Game Info was before
  { path: 'game', pathMatch: 'full', redirectTo: 'game-info/maps' },
  { path: '**', redirectTo: 'replays/matches' },
];
