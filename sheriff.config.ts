import { anyTag, sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Module boundaries for the workspace (Sheriff), during the domain-packages conversion. Converted
 * domains (packages/<domain>/<layer>) follow the spec's domain and layer rules; the packages not yet
 * converted keep the import directions they have; the app's own files are Sheriff's root module.
 */

/** Converted domain packages and the layers each has (packages/<domain>/<layer>/index.ts). */
const domains: Record<string, readonly string[]> = {
  common: ['ui', 'model'],
  heroes: ['provide', 'data', 'ui', 'model', 'testing'],
  import: ['provide', 'feature', 'ui', 'data', 'model'],
  layout: ['ui', 'model'],
  platform: ['provide', 'data', 'model'],
  settings: ['provide', 'feature', 'ui', 'data'],
  shell: ['feature', 'ui', 'data'],
};

/**
 * Smart components loaded on their own (a routed page, a slot's component shown at startup), each a
 * module of its own inside its domain's `feature` (packages/<domain>/feature/<name>/index.ts), so
 * importing one does not bring in the rest of the layer.
 */
const featureModules: Record<string, readonly string[]> = {
  import: ['import-page', 'import-toolbar-action'],
};

/** Shared domains: any domain may use them; a shared domain uses another only through `uses`. */
const shared = ['common', 'layout', 'platform', 'settings', 'shell'];

/** The domains each domain may use besides itself, the shared ones and simple libraries; one way only. */
const uses: Record<string, readonly string[]> = {
  settings: ['layout', 'platform', 'shell'],
  shell: ['platform'],
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
    'packages/map/src': ['domain:maps', 'type:package'],
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
    'type:provide': [
      'type:feature',
      'type:ui',
      'type:data',
      'type:model',
      'type:lib',
      testingInSpecs,
    ],
    'type:feature': [
      'type:feature',
      'type:ui',
      'type:data',
      'type:model',
      'type:lib',
      testingInSpecs,
    ],
    'type:ui': ['type:ui', 'type:model', 'type:lib', testingInSpecs],
    'type:data': ['type:data', 'type:model', 'type:lib', testingInSpecs],
    'type:model': ['type:model', 'type:lib', testingInSpecs],
    'type:testing': ['type:testing', 'type:data', 'type:model', 'type:lib'],
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
