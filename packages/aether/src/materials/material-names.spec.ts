import { describe, expect, it } from 'vitest';
import { materialLabel, textureLabel, textureWords } from './material-names';
import type { SceneMaterial } from '../formats/play-scene';

const material = (texture: string): SceneMaterial => ({
  blend: 'alphaAdd',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse: { texture, brightMult: 1 },
  emissive: null,
  alphaMasks: [],
});

describe('materials’ names', () => {
  it('come from their part where it says what they are', () => {
    expect(materialLabel('material10-play-large', material('grid'), {}, 'shield')).toBe(
      'Shield grid',
    );
    expect(materialLabel('atmospherePlanetLarge', material('grad'), {}, 'ring')).toBe('Ring');
  });

  it('are their own names made readable where those say something', () => {
    expect(materialLabel('atmospherePlanetLarge', undefined, {})).toBe('Atmosphere planet large');
    expect(materialLabel('staticStars', undefined, {})).toBe('Static stars');
    expect(materialLabel('edgeLight222-korhal', undefined, {})).toBe('Edge light');
  });

  it('come from their main texture where their own names say nothing', () => {
    const textures = {
      'play-large-birthglow': {
        file: 'x.webp',
        width: 1,
        height: 1,
        source: 'Assets/Textures/Storm_UI_HeroSelection_Floor_PlanetBirthGlow.dds',
      },
    };
    expect(materialLabel('planet-play-large', material('play-large-birthglow'), textures)).toBe(
      'Planet birth glow',
    );
    expect(materialLabel('material6DUP-play-medium', material('blueplanet'), {})).toBe(
      'Blueplanet',
    );
  });

  it('read a texture’s file name without the words that only say how it is stored', () => {
    expect(textureWords('Assets\\Textures\\Storm_LootUI_Grid_DIff.dds')).toEqual(['Loot', 'Grid']);
    expect(textureWords('Assets/Textures/Storm_UI_HeroSelection_Floor_BluePlanet.dds')).toEqual([
      'Blue',
      'Planet',
    ]);
  });

  it('name a texture by its file name’s words, else its key', () => {
    expect(
      textureLabel('grid', {
        file: 'g.webp',
        width: 1,
        height: 1,
        source: 'Assets/Textures/Storm_LootUI_Grid_DIff.dds',
      }),
    ).toBe('Loot grid');
    expect(textureLabel('ui', undefined)).toBe('ui');
  });
});
