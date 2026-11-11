import { describe, expect, it } from 'vitest';
import type { AddedLight, BodyLight } from './lights';
import { type FlowNode, flowLights, lightsOut, sourceIdOf } from './light-flow';

const lamp = (id: string, s: Partial<AddedLight> = {}): AddedLight => ({
  id: `added-${id}`,
  kind: 'point',
  name: id,
  ...s,
});
// A scene: planet p with moon m (its own moon mm), planet q; a group g of planet r with moon rm.
const tree = (lights: Record<string, readonly AddedLight[]>): FlowNode[] =>
  [
    { key: 'p' },
    { key: 'm', parent: 'p' },
    { key: 'mm', parent: 'm' },
    { key: 'q' },
    { key: 'r', group: 'g' },
    { key: 'rm', parent: 'r', group: 'g' },
  ].map((branch) => ({ branch, lights: lights[branch.key] ?? [] }));
const lit = (flowed: ReturnType<typeof flowLights>, id: string) =>
  [...flowed]
    .filter(([, ls]) => ls.some((l) => l.light.id === `added-${id}`))
    .map(([k]) => k)
    .sort();

describe('lights flowing through a scene', () => {
  it('reach what is under their body where they light down; nothing beyond unless out says', () => {
    const flowed = flowLights(
      tree({ p: [lamp('down', { down: true }), lamp('alone'), lamp('old', { moons: true })] }),
    );
    expect(lit(flowed, 'down')).toEqual(['m', 'mm']);
    expect(lit(flowed, 'alone')).toEqual([]);
    // (A light kept from before, reaching its moons, as it did.)
    expect(lit(flowed, 'old')).toEqual(['m', 'mm']);
  });

  it('reach out to the planet, the group or the scene; not their own moons where not down', () => {
    const flowed = flowLights(
      tree({
        m: [lamp('planet', { out: 'planet' }), lamp('planetDown', { out: 'planet', down: true })],
        rm: [lamp('group', { out: 'group' })],
        q: [lamp('scene', { out: 'scene' }), lamp('none', { out: 'none' })],
      }),
    );
    expect(lit(flowed, 'planet')).toEqual(['p']);
    expect(lit(flowed, 'planetDown')).toEqual(['mm', 'p']);
    expect(lit(flowed, 'group')).toEqual(['r']);
    expect(lit(flowed, 'scene')).toEqual(['m', 'mm', 'p', 'r', 'rm']);
    expect(lit(flowed, 'none')).toEqual([]);
  });

  it('carry nothing of what a light reaches of its own body, nor one switched off', () => {
    const flowed = flowLights(
      tree({
        p: [
          lamp('linked', { down: true, reach: { mode: 'only', receivers: ['part:own:sphere-1'] } }),
          lamp('off', { down: true, enabled: false }),
        ],
      }),
    );
    const linked = flowed.get('m')?.find((l) => l.light.id === 'added-linked');
    expect(linked?.from).toBe('p');
    expect(linked?.light.reach).toBeUndefined();
    expect(lit(flowed, 'off')).toEqual([]);
  });

  it("give a body's data lights set to reach out an id of their owner's", () => {
    const key: BodyLight = {
      id: 'directional-0',
      kind: 'directional',
      name: 'Key light',
      enabled: true,
      darkens: false,
      colour: '#ffffff',
      strength: 1.33,
    };
    expect(lightsOut('korhal', [key], [], {})).toEqual([]);
    const out = lightsOut('korhal', [key], [lamp('mine', { down: true })], {
      'directional-0': { down: true },
    });
    expect(out.map((l) => l.id)).toEqual(['added-~korhal~directional-0', 'added-mine']);
    expect(out[0]).toMatchObject({ kind: 'directional', strength: 1.33, down: true });
    expect(out.map((l) => sourceIdOf(l.id))).toEqual(['directional-0', 'added-mine']);
  });
});
