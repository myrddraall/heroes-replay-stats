import type { Routes } from '@angular/router';

/** The renderer check's route (`provideDevFeature` adds it): it fills the window, without the shell. */
export const DEV_ROUTES: Routes = [
  // Long lists on one page, each drawing only what is in view.
  {
    path: 'lists-check',
    title: 'Lists check · Heroes Replay Stats',
    loadComponent: () => import('../feature/lists-check-page').then((m) => m.ListsCheckPage),
  },
  // Both renderers drawing the site's background at once, their pictures compared.
  {
    path: 'renderer-check',
    title: 'Renderer check · Heroes Replay Stats',
    data: { shell: false },
    loadComponent: () =>
      import('../feature/renderer-check-page').then((m) => m.RendererCheckPage),
  },
];
