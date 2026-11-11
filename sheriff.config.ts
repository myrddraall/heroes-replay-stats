import { anyTag, sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Module boundaries for the workspace (Sheriff), during the domain-packages conversion. Converted
 * domains (packages/<domain>/<layer>) follow the spec's domain and layer rules; the packages not yet
 * converted keep the import directions they have; the app's own files are Sheriff's root module.
 */

/** Converted domain packages and the layers each has (packages/<domain>/<layer>/index.ts). */
const domains: Record<string, readonly string[]> = {
  background: ['provide', 'feature', 'ui', 'data', 'model'],
  common: ['ui', 'model'],
  dev: ['provide', 'feature', 'ui', 'data', 'model'],
  heroes: ['provide', 'data', 'ui', 'model', 'testing'],
  import: ['provide', 'feature', 'ui', 'data', 'model'],
  'data-views': ['ui', 'data', 'model', 'testing'],
  layout: ['ui', 'model'],
  maps: ['provide', 'feature', 'ui', 'data', 'model', 'testing'],
  platform: ['provide', 'data', 'model'],
  players: ['provide', 'feature', 'ui', 'data', 'model'],
  replays: ['provide', 'feature', 'ui', 'data', 'model'],
  settings: ['provide', 'feature', 'ui', 'data'],
  sheets: ['provide', 'data', 'ui', 'model', 'testing'],
  shell: ['feature', 'ui', 'data', 'model'],
  theme: ['provide', 'feature', 'ui', 'data', 'model'],
};

/**
 * Smart components loaded on their own (a routed page, a slot's component shown at startup), each a
 * module of its own inside its domain's `feature` (packages/<domain>/feature/<name>/index.ts), so
 * importing one does not bring in the rest of the layer.
 */
const featureModules: Record<string, readonly string[]> = {
  background: ['site-backdrop', 'graphics-section', 'theme-preview-page'],
  import: ['import-page', 'import-toolbar-action', 'clear-match-data-dialog'],
  dev: [
    'hero-frame-page',
    'talent-frame-page',
    'team-frame-page',
    'circle-frame-page',
    'standard-tooltip-page',
    'talent-tooltip-page',
    'lists-check-page',
    'renderer-check-page',
  ],
  maps: ['maps-page', 'map-page'],
  players: [
    'players-page',
    'player-page',
    'overview-section',
    'stats-section',
    'records-section',
    'peers-section',
    'matches-section',
  ],
  replays: [
    'replays-page',
    'replay-page',
    'score-section',
    'teams-section',
    'draft-section',
    'talents-section',
    'chat-section',
    'stats-section',
    'unit-kills-section',
    'xp-section',
    'timeline-section',
    'player-chart-section',
  ],
};

/** Shared domains: any domain may use them; a shared domain uses another only through `uses`. */
const shared = [
  'common',
  'data-views',
  'layout',
  'platform',
  'settings',
  'sheets',
  'shell',
  'theme',
];

/** The domains each domain may use besides itself, the shared ones and simple libraries; one way only. */
const uses: Record<string, readonly string[]> = {
  // Everything else reaches aether through background.
  background: ['aether', 'aether-forge'],
  // Developer tools for aether itself, which reach into its areas; and the UI area's catalogue of
  // components, which shows the heroes' (the hero frame).
  dev: ['aether', 'heroes'],
  maps: ['background', 'heroes'],
  players: ['heroes', 'import', 'replays'],
  replays: ['heroes', 'import'],
  settings: ['layout', 'platform', 'shell'],
  shell: ['platform', 'sheets'],
  theme: ['settings', 'shell'],
};

/** A domain's `testing` entry point (test doubles) is for spec files only. */
const isSpec = (path: string) => path.endsWith('.spec.ts');
const testingInSpecs = ({ to, fromFilePath }: { to: string; fromFilePath: string }) =>
  to === 'type:testing' && isSpec(fromFilePath);

/** aether's areas, one barrel each (packages/aether/src/<area>/index.ts). */
const aetherAreas = [
  'aids',
  'bodies',
  'camera',
  'design',
  'formats',
  'graphics',
  'library',
  'lights',
  'materials',
  'overlays',
  'planet-sets',
  'render',
  'scenes',
  'sky',
  'space',
  'tints',
  'variants',
  'view',
];

export const config: SheriffConfig = {
  entryPoints: {
    web: 'apps/web/src/main.ts',
    'replay-worker': 'packages/import/data/replay.worker.ts',
    'desktop-main': 'apps/desktop/src/main.ts',
    'desktop-preload': 'apps/desktop/src/preload.ts',
  },
  modules: {
    ...Object.fromEntries(
      Object.entries(domains).flatMap(([domain, layers]) => [
        [`packages/${domain}`, [`domain:${domain}`, 'type:main']],
        ...layers.map((layer) => [
          `packages/${domain}/${layer}`,
          [`domain:${domain}`, `type:${layer}`],
        ]),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(featureModules).flatMap(([domain, names]) =>
        names.map((name) => [
          `packages/${domain}/feature/${name}`,
          [`domain:${domain}`, 'type:feature'],
        ]),
      ),
    ),
    'packages/aether/src': ['domain:aether', 'type:engine'],
    ...Object.fromEntries(
      aetherAreas.map((area) => [`packages/aether/src/${area}`, ['domain:aether', 'type:engine']]),
    ),
    'packages/aether-forge/src': ['domain:aether-forge', 'type:engine'],
    'libs/signals/src': ['type:lib'],
    'libs/analysers/src': ['type:lib'],
  },
  depRules: {
    // The app's own files: unrestricted until its domains move out, but for `testing` outside specs.
    root: ({ toTags, fromFilePath }: { toTags: string[]; fromFilePath: string }) =>
      !toTags.includes('type:testing') || isSpec(fromFilePath),
    ...Object.fromEntries(
      Object.keys(domains).map((domain) => [
        `domain:${domain}`,
        ({ to }: { to: string }) => {
          const target = to.replace('domain:', '');
          return (
            to === 'type:lib' ||
            target === domain ||
            (!shared.includes(domain) && shared.includes(target)) ||
            (uses[domain] ?? []).includes(target)
          );
        },
      ]),
    ),
    'type:main': [],
    // 'type:engine' in each layer: aether, for the domains whose `uses` list it (background, and
    // dev's tools), is their engine.
    'type:provide': [
      'type:feature',
      'type:ui',
      'type:data',
      'type:model',
      'type:lib',
      testingInSpecs,
      'type:engine',
    ],
    'type:feature': [
      'type:feature',
      'type:ui',
      'type:data',
      'type:model',
      'type:lib',
      testingInSpecs,
      'type:engine',
    ],
    'type:ui': ['type:ui', 'type:model', 'type:lib', testingInSpecs, 'type:engine'],
    'type:data': ['type:data', 'type:model', 'type:lib', testingInSpecs, 'type:engine'],
    'type:model': ['type:model', 'type:lib', testingInSpecs, 'type:engine'],
    'type:testing': ['type:testing', 'type:data', 'type:model', 'type:lib'],
    'type:lib': ['type:lib'],
    // Packages not yet converted.
    'domain:aether': [sameTag, 'type:lib'],
    'domain:aether-forge': [sameTag, 'domain:aether', 'domain:common', 'type:lib'],
    'type:engine': anyTag,
    noTag: ['noTag', 'root'],
  },
};
