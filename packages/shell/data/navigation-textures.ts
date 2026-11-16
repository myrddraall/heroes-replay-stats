import { computed, inject, resource, type Signal } from '@angular/core';
import { type PieceCut, SHEET_PICTURES } from '@myrddraall/heroes-replay-stats-sheets/model';

/** The interface sheet the navigation bars' textures are in (heroes-assets ui-sheets/navigation.json). */
export const NAVIGATION_SHEET = 'navigation';

/**
 * The game textures the theme's bars draw with (the TopBar, SubBar, NavTree and SideNav in
 * nexus.css), by the custom property the stylesheet reads each from: the sheet's picture, and how
 * far it turns (clockwise) first.
 */
export const NAVIGATION_TEXTURES: Readonly<Record<string, { picture: string; rotate?: 90 }>> = {
  '--hrs-tex-mainnavigation-background': { picture: 'background' },
  '--hrs-tex-mainnavigation-subbackground': { picture: 'subbackground' },
  '--hrs-tex-mainnavigation-shimmer': { picture: 'shimmer' },
  '--hrs-tex-triangle-mask': { picture: 'triangle-mask' },
  '--hrs-tex-mainnavigation-hover': { picture: 'hover' },
  '--hrs-tex-mainnavigation-hover-underline': { picture: 'hover-underline' },
  '--hrs-tex-mainnavigation-hover-particle': { picture: 'hover-particle' },
  '--hrs-tex-mainnavigation-separator': { picture: 'separator' },
  '--hrs-tex-mainnavigation-separator-sub': { picture: 'separator-sub' },
  // the underline stood upright on a tree's guide line
  '--hrs-tex-underline-vertical': { picture: 'hover-underline', rotate: 90 },
};

/**
 * The navigation textures as custom properties (`url(…)` of each cut piece), for a host's style:
 * all of them at once when the sheet has loaded and every piece is cut, `{}` until then, so the
 * bars never show the shimmer before its mask.
 */
export function injectNavigationTextures(): Signal<Readonly<Record<string, string>>> {
  const pictures = inject(SHEET_PICTURES);
  const url = pictures.sheetUrl(NAVIGATION_SHEET);
  pictures.load(url);
  const cuts = computed((): Record<string, PieceCut> | undefined => {
    const status = pictures.status(url);
    if (status?.status !== 'ready') return undefined;
    const places = status.picture.meta?.pictures ?? {};
    const entries = Object.entries(NAVIGATION_TEXTURES).flatMap(([property, { picture, rotate }]) => {
      const rect = places[picture];
      return rect ? [[property, { rect, rotate }] as const] : [];
    });
    return Object.fromEntries(entries);
  });
  const pieces = resource({
    params: cuts,
    loader: async ({ params }) => {
      const urls = await Promise.all(
        Object.entries(params).map(
          async ([property, cut]) => [property, `url("${await pictures.piece(url, cut)}")`] as const,
        ),
      );
      return Object.fromEntries(urls);
    },
  });
  return computed(() => (pieces.hasValue() ? pieces.value() : {}));
}
