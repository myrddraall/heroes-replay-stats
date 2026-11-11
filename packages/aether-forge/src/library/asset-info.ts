import { DATA_URL } from '@myrddraall/heroes-replay-stats-aether';
import { overlayFileFor } from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  type MoonChoices,
  PLAY_SCREEN_SCENE,
  RANDOM_SCENE,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { Component, computed, inject } from '@angular/core';
import { DraftDesignStore } from '../draft/draft-design.store';
import { AssetCatalogStore } from './asset-catalog.store';
import { type AssetDetails, AssetDetailsView } from './asset-details';
import { Editor } from '../editing/editor';
import { partMaterials, texturesOf } from '../materials/materials';
const PLANET_KINDS: Readonly<Record<string, string>> = {
  play: 'Play screen planet',
  world: 'Flyby world',
  painted: 'Painted planet',
};

/** How many moons there are about a body, theirs too. */
const moonCount = (moons: readonly MoonChoices[] | undefined): number =>
  (moons ?? []).reduce((n, m) => n + 1 + moonCount(m.moons), 0);

/** What is set of it, in words: how many settings, or none (the game data's). */
const setOf = (settings: object | undefined) => {
  const n = Object.keys(settings ?? {}).length;
  return n ? `${n} set in the library` : 'As the game data has it';
};

/**
 * What is selected in the library's lists, as information (container, on the `Editor` in effect,
 * which shows it, and the page's catalog and draft): what it is, what it is made of or used by,
 * what of it is set; no controls (it is opened to be set).
 */
@Component({
  selector: 'forge-asset-info',
  imports: [AssetDetailsView],
  templateUrl: './asset-info.html',
})
export class AssetInfo {
  private readonly editor = inject(Editor);
  private readonly catalog = inject(AssetCatalogStore);
  private readonly draft = inject(DraftDesignStore);
  /** Where the game data is served, for the textures' links. */
  protected readonly dataUrl = inject(DATA_URL);

  protected readonly details = computed((): AssetDetails | null => {
    const { kind, id } = this.editor.opened();
    const c = this.catalog;
    const library = this.draft.library();
    const none = { facts: [], lists: [], textures: [] };
    switch (kind) {
      case 'scene': {
        const scene = this.draft.scenes().planets[id];
        if (id === PLAY_SCREEN_SCENE)
          return {
            ...none,
            kind: 'Scene',
            facts: [
              { label: 'Planets', value: "The game's three, where it puts them" },
              { label: 'Sky', value: scene?.sky ? 'Set in the scene' : "The library's" },
            ],
          };
        if (id === RANDOM_SCENE)
          return {
            ...none,
            kind: 'Scene',
            facts: [
              { label: 'Planets', value: 'A set drawn with each page' },
              { label: 'Sky', value: scene?.sky ? 'Set in the scene' : "The library's" },
            ],
          };
        const shows = this.catalog.scenes().find((s) => s.id === id)?.shows ?? '';
        return {
          ...none,
          kind: 'Scene',
          facts: [
            { label: 'Name', value: scene?.name ?? '(none)' },
            { label: 'Planets', value: shows },
            {
              label: 'Moons',
              value: String(
                c
                  .planetsOf()(id)
                  .reduce((n, b) => n + moonCount(b.moons), 0),
              ),
            },
            { label: 'Sky', value: scene?.sky ? 'Set in the scene' : "The library's" },
          ],
        };
      }
      case 'group': {
        const group = this.draft.scenes().planets[id];
        const shows = this.catalog.groups().find((g) => g.id === id)?.shows ?? '';
        const placed = Object.values(this.draft.scenes().planets).filter((p) =>
          p.groups?.some((g) => g.group === id),
        ).length;
        return {
          ...none,
          kind: 'Group',
          facts: [
            { label: 'Name', value: group?.name ?? '(none)' },
            { label: 'Has', value: shows },
            { label: 'Put in', value: placed ? `${placed} scenes or groups` : 'Nowhere yet' },
          ],
        };
      }
      case 'planet':
      case 'style': {
        const file = c.files()[kind === 'planet' ? id : overlayFileFor(library, id)];
        const entry = c.planets().find((p) => p.id === id);
        const settings = (kind === 'planet' ? library.planets : library.styles)[id];
        return {
          ...none,
          kind: kind === 'planet' ? (PLANET_KINDS[entry?.kind ?? ''] ?? 'Planet') : 'Overlay',
          facts: [
            { label: 'Library', value: setOf(settings) },
            ...(kind === 'planet' && file?.tuning?.style
              ? [{ label: 'Wears', value: file.tuning.style }]
              : []),
            ...(kind === 'planet'
              ? [
                  {
                    label: 'In scenes',
                    value:
                      c
                        .scenes()
                        .filter((s) =>
                          c
                            .planetsOf()(s.id)
                            .some((b) => b.id === id),
                        )
                        .map((s) => s.label)
                        .join(', ') || 'None',
                  },
                ]
              : []),
          ],
          lists: [
            {
              title: 'Materials',
              items: file ? partMaterials(file).map((m) => m.name) : [],
            },
          ],
        };
      }
      case 'material': {
        const material = c.materialByName().get(id);
        const use = material?.uses[0];
        return {
          kind: 'Material',
          facts: [
            ...(use ? [{ label: 'Blend', value: use.material.blend }] : []),
            { label: 'Base', value: setOf(library.materials?.[id]) },
          ],
          lists: [
            {
              title: 'Used by',
              items: material?.uses.map((u) => (u.kind === 'sky' ? 'the sky' : u.id)) ?? [],
            },
          ],
          textures: use ? texturesOf(use.material, use.textures) : [],
        };
      }
      case 'particle': {
        const p = c.particles().find((s) => s.id === id);
        return {
          ...none,
          kind: 'Particle system',
          facts: p
            ? [
                { label: 'Material', value: p.material },
                { label: 'Rate', value: `${p.rate} a second` },
                { label: 'At most', value: String(p.max) },
                { label: 'Life', value: `${p.lifespan[0]} to ${p.lifespan[1]} s` },
              ]
            : [],
        };
      }
      case 'sky':
        return {
          ...none,
          kind: 'Sky',
          facts: [
            { label: 'Library', value: setOf(library.sky) },
            {
              label: 'Particles',
              value:
                c
                  .particles()
                  .map((p) => p.id)
                  .join(', ') || 'None',
            },
          ],
          lists: [{ title: 'Materials', items: c.skyMaterials() }],
        };
    }
  });
}
