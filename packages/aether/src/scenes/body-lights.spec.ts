import { describe, expect, it } from 'vitest';
import { withLightSwitched } from './body-lights';

describe('switching a light or a material on or off', () => {
  it('sets it only where it differs from the levels under it', () => {
    // On under it: switched off is set here; back on is nothing set.
    const off = withLightSwitched({}, 'ambient', false, true)!;
    expect(off).toEqual({ lights: { ambient: { enabled: false } } });
    expect(withLightSwitched(off, 'ambient', true, true)).toBeUndefined();
    // Off under it (switched off in the library): switched on is set; what else is set is kept.
    const set = { lights: { shadow: { strength: 2 } } };
    expect(withLightSwitched(set, 'shadow', true, false)).toEqual({
      lights: { shadow: { strength: 2, enabled: true } },
    });
    expect(
      withLightSwitched(
        { lights: { shadow: { strength: 2, enabled: true } } },
        'shadow',
        false,
        false,
      ),
    ).toEqual(set);
  });

  it('switches a light added at the level edited itself, on as it starts', () => {
    const lamp = { id: 'added-lamp', kind: 'ambient', name: 'Lamp' } as const;
    const off = withLightSwitched({ added: [lamp] }, lamp.id, false, true)!;
    expect(off.added).toEqual([{ ...lamp, enabled: false }]);
    expect(withLightSwitched(off, lamp.id, true, true)!.added).toEqual([lamp]);
  });
});
