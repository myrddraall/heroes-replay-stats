import { anyTag, sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Module boundaries for the workspace (Sheriff), during the domain-packages conversion. Converted
 * domains (packages/<domain>/<layer>) follow the spec's domain and layer rules; the packages not yet
 * converted keep the import directions they have; the app's own files are Sheriff's root module.
 */

/** Converted domain packages and the layers each has (packages/<domain>/<layer>/index.ts). */
const domains: Record<string, readonly string[]> = {
  common: ['ui', 'model'],
  layout: ['ui', 'model'],
  platform: ['provide', 'data', 'model'],
  settings: ['provide', 'feature', 'ui', 'data'],
};

/** Shared domains: any domain may use them; a shared domain uses another only through `uses`. */
const shared = ['common', 'layout', 'platform', 'settings'];

/** The domains each domain may use besides itself, the shared ones and simple libraries; one way only. */
const uses: Record<string, readonly string[]> = {
  settings: ['layout', 'platform'],
};

/** aether's areas, one barrel each (packages/aether/src/<area>/index.ts). */
const aetherAreas = [
  'aids',
  'bodies',
  'camera',
  'design',
  'formats',
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
    'replay-worker': 'apps/web/src/app/data/import/replay.worker.ts',
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
    'packages/aether/src': ['domain:aether', 'type:engine'],
    ...Object.fromEntries(
      aetherAreas.map((area) => [`packages/aether/src/${area}`, ['domain:aether', 'type:engine']]),
    ),
    'packages/aether-forge/src': ['domain:aether-forge', 'type:engine'],
    'packages/map/src': ['domain:maps', 'type:package'],
    'libs/signals/src': ['type:lib'],
    'libs/analysers/src': ['type:lib'],
  },
  depRules: {
    // The app's own files: unrestricted until its domains move out.
    root: anyTag,
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
    'type:provide': ['type:feature', 'type:ui', 'type:data', 'type:model', 'type:lib'],
    'type:feature': ['type:feature', 'type:ui', 'type:data', 'type:model', 'type:lib'],
    'type:ui': ['type:ui', 'type:model', 'type:lib'],
    'type:data': ['type:data', 'type:model', 'type:lib'],
    'type:model': ['type:model', 'type:lib'],
    'type:lib': ['type:lib'],
    // Packages not yet converted.
    'domain:aether': [sameTag, 'type:lib'],
    'domain:aether-forge': [sameTag, 'domain:aether', 'domain:common', 'type:lib'],
    'domain:maps': [sameTag],
    'type:engine': anyTag,
    'type:package': anyTag,
    noTag: ['noTag', 'root'],
  },
};
