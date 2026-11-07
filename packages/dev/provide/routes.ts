import type { Routes } from '@angular/router';

/**
 * The developer tools' routes (`provideDevFeature` adds them): the UI area's (its Theme section's
 * page is the background's) with its tests, and the renderer check, which fills the window,
 * without the shell.
 */
export const DEV_ROUTES: Routes = [
  { path: 'ui', pathMatch: 'full', redirectTo: 'ui/theme' },
  // straight to the first page: a redirect isn't followed into another
  { path: 'ui/components', pathMatch: 'full', redirectTo: 'ui/components/frames/hero' },
  // The frames, a page each: each in its states, themes and sizes.
  { path: 'ui/components/frames', pathMatch: 'full', redirectTo: 'ui/components/frames/hero' },
  {
    path: 'ui/components/frames/hero',
    title: 'Hero frame · Frames · Components · Heroes Replay Stats',
    loadComponent: () => import('../feature/hero-frame-page').then((m) => m.HeroFramePage),
  },
  {
    path: 'ui/components/frames/talent',
    title: 'Talent frame · Frames · Components · Heroes Replay Stats',
    loadComponent: () => import('../feature/talent-frame-page').then((m) => m.TalentFramePage),
  },
  // The tooltips, a page each.
  { path: 'ui/components/tooltips', pathMatch: 'full', redirectTo: 'ui/components/tooltips/standard' },
  {
    path: 'ui/components/tooltips/standard',
    title: 'Standard tooltip · Tooltips · Components · Heroes Replay Stats',
    loadComponent: () =>
      import('../feature/standard-tooltip-page').then((m) => m.StandardTooltipPage),
  },
  {
    path: 'ui/components/tooltips/talent',
    title: 'Talent tooltip · Tooltips · Components · Heroes Replay Stats',
    loadComponent: () => import('../feature/talent-tooltip-page').then((m) => m.TalentTooltipPage),
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
