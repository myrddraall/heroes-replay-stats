import { describe, expect, it } from 'vitest';
import type { AddedLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import { type BodyInfo } from '../bodies/body';
import { file } from '../bodies/body-fixtures';
import { bodyLink } from './linking';

// A light of a planet's handed on to its moon (one that darkens: it acts on any material).
const lamp: AddedLight = { id: 'added-lamp', kind: 'point', name: 'Lamp', darkens: true };
const moon = (settings: BodyInfo['settings']): BodyInfo => ({
  key: 'body:0/moon-1',
  id: 'moon',
  overlays: [],
  overlaysSet: false,
  settings,
  file: file('world'),
  moons: [],
});
const at = { key: 'body:0/moon-1', label: 'moon', depth: 1, own: false };
const outer = [{ light: lamp, owner: ['0'], from: 'play-medium' }];

describe("a light's Linking", () => {
  it('lists a body it lights as its Lit by has it, with its parts and materials under it', () => {
    const link = bodyLink(moon({}), lamp.id, outer, at);
    expect(link).toMatchObject({ lit: true, changed: false });
    expect(link?.parts.map((p) => [p.receiver, p.lit])).toEqual([
      ['part:own:sphere-1', true],
      ['material:clouds', true],
    ]);
  });

  it('shows what the body sets of it at the level edited: left out, or some of it', () => {
    expect(
      bodyLink(moon({ lights: { [lamp.id]: { enabled: false } } }), lamp.id, outer, at),
    ).toMatchObject({ lit: false, changed: true });
    const some = bodyLink(
      moon({ lights: { [lamp.id]: { reach: { mode: 'except', receivers: ['material:clouds'] } } } }),
      lamp.id,
      outer,
      at,
    );
    expect(some?.changed).toBe(true);
    expect(some?.parts.find((p) => p.receiver === 'material:clouds')?.lit).toBe(false);
  });

  it('leaves out a body the light does nothing to', () => {
    expect(bodyLink(moon({}), lamp.id, [], at)).toBeNull();
  });
});
