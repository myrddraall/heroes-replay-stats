/**
 * Where the app reads its maps (the ones heroes-maps publishes) and its interface sheets (the
 * frames heroes-assets cuts from the game, live channel); no dev reports sent.
 */
export const environment = {
  mapPacksUrl: 'https://myrddraall.github.io/heroes-maps/maps/',
  uiSheetsUrl: 'https://myrddraall.github.io/heroes-assets/live/ui/',
  devReportsUrl: null,
} as const;
