import type { SceneMaterial, SceneTexture } from './play-scene';
import type { PartRole } from './scene-planets';

/**
 * Materials' names as people read them. The game data's names are an artist's working names
 * ("Material #10", "Planet~DUP", their exported keys `material10-play-large`, `planetDUP-play-medium`);
 * where they say what the material is ("atmospherePlanetLarge", "staticStars") they are made
 * readable, and where they don't the material is named after its part (a shield's grid, a ring)
 * or its main texture ("Storm_UI_HeroSelection_Floor_PlanetBirthGlow": "Planet birth glow").
 */

/** What a part makes of its material's name, where its role says more than the data's name. */
const ROLE_NAMES: Partial<Record<PartRole, string>> = { shield: 'Shield grid', ring: 'Ring' };

/** Words of a texture's file name that only say how it is stored or where it is used. */
const NOISE = new Set([
  'storm',
  'ui',
  'hero',
  'selection',
  'floor',
  'diff',
  'diffuse',
  'emis',
  'dds',
]);

/** Words in a name: split at underscores, dashes, digits and lower-to-upper case changes. */
function words(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z]+/)
    .filter(Boolean);
}

/** Words as a name: the first capitalised, the rest lower case (acronyms kept). */
function sentence(list: readonly string[]): string {
  return list
    .map((w, i) => {
      const lower = w === w.toUpperCase() && w.length > 1 ? w : w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/** A data name's words, without its planet's suffix and copy marks; none where all it says is generic. */
function ownWords(name: string): string[] {
  const base = name.replace(/-(play-(large|medium|small)|[a-z]+)$/, '').replace(/DUP\d*$/i, '');
  const found = words(base);
  return found.every((w) => /^(material|planet|dup)$/i.test(w)) ? [] : found;
}

/** A texture's file name made readable: its words, without the ones that only say how it's stored. */
export function textureWords(source: string): string[] {
  const file = source.split(/[\\/]/).pop() ?? source;
  const stem = file.replace(/\.[a-z0-9]+$/i, '').replace(/_(diff|diffuse|emis|emissive)$/i, '');
  return words(stem).filter((w) => !NOISE.has(w.toLowerCase()));
}

/**
 * A material's name as people read it: from its part's role (a style's shield, a ring), else its
 * own name where that says something, else its main texture's (diffuse, then emissive), else its
 * data name as it is.
 */
export function materialLabel(
  name: string,
  material: SceneMaterial | undefined,
  textures: Readonly<Record<string, SceneTexture>>,
  role?: PartRole,
): string {
  const byRole = role ? ROLE_NAMES[role] : undefined;
  if (byRole) return byRole;
  const own = ownWords(name);
  if (own.length) return sentence(own);
  for (const layer of [material?.diffuse, material?.emissive]) {
    const key = layer?.texture;
    if (!key) continue;
    const found = textureWords(textures[key]?.source ?? key);
    if (found.length) return sentence(found);
  }
  return name;
}

/** A texture's name as people read it: its file name's words (its key where they say nothing). */
export function textureLabel(key: string, texture: SceneTexture | undefined): string {
  const found = textureWords(texture?.source ?? key);
  return found.length ? sentence(found) : key;
}
