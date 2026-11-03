import type { Routes } from '@angular/router';

/** The renderer check's route (`provideDevFeature` adds it): it fills the window, without the shell. */
export const DEV_ROUTES: Routes = [
  // Both renderers drawing the site's background at once, their pictures compared.
  {
    path: 'renderer-check',
    title: 'Renderer check · Heroes Replay Stats',
    data: { shell: false },
    loadComponent: () =>
      import('../feature/renderer-check-page').then((m) => m.RendererCheckPage),
  },
];
