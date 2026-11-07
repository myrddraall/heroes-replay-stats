import type { Routes } from '@angular/router';

/**
 * The developer tools' routes (`provideDevFeature` adds them): the UI area's (its Theme section's
 * page is the background's) with its tests, and the renderer check, which fills the window,
 * without the shell.
 */
export const DEV_ROUTES: Routes = [
  { path: 'ui', pathMatch: 'full', redirectTo: 'ui/theme' },
  { path: 'ui/components', pathMatch: 'full', redirectTo: 'ui/components/frames' },
  // The frames, each in its states and themes.
  {
    path: 'ui/components/frames',
    title: 'Frames · Components · Heroes Replay Stats',
    loadComponent: () => import('../feature/frames-page').then((m) => m.FramesPage),
  },
  { path: 'ui/tests', pathMatch: 'full', redirectTo: 'ui/tests/lists' },
  // Long lists on one page, each drawing only what is in view.
  {
    path: 'ui/tests/lists',
    title: 'Lists · Tests · Heroes Replay Stats',
    loadComponent: () => import('../feature/lists-check-page').then((m) => m.ListsCheckPage),
  },
  { path: 'lists-check', redirectTo: 'ui/tests/lists' },
  // Both renderers drawing the site's background at once, their pictures compared.
  {
    path: 'renderer-check',
    title: 'Renderer check · Heroes Replay Stats',
    data: { shell: false },
    loadComponent: () =>
      import('../feature/renderer-check-page').then((m) => m.RendererCheckPage),
  },
];
