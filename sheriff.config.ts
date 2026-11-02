import { anyTag, sameTag, type SheriffConfig } from '@softarc/sheriff-core';

/**
 * Module boundaries for the workspace (Sheriff). Phase 1 of the domain-packages conversion: today's
 * packages are tagged and keep the import directions they have; the app's own files are Sheriff's
 * root module. Domain and layer rules arrive as each domain is converted.
 */

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
    'packages/aether/src': ['domain:aether', 'type:engine'],
    ...Object.fromEntries(
      aetherAreas.map((area) => [`packages/aether/src/${area}`, ['domain:aether', 'type:engine']]),
    ),
    'packages/aether-forge/src': ['domain:aether-forge', 'type:engine'],
    'packages/map/src': ['domain:maps', 'type:package'],
    'packages/ui/src': ['domain:common', 'type:package'],
    'libs/signals/src': ['type:lib'],
    'libs/analysers/src': ['type:lib'],
  },
  depRules: {
    // The app's own files: unrestricted until its domains move out.
    root: anyTag,
    'domain:aether': [sameTag, 'type:lib'],
    'domain:aether-forge': [sameTag, 'domain:aether', 'domain:common', 'type:lib'],
    'domain:maps': [sameTag],
    'domain:common': [sameTag],
    'type:engine': anyTag,
    'type:package': anyTag,
    'type:lib': ['type:lib'],
    noTag: ['noTag', 'root'],
  },
};
