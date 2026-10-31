import { describe, expect, it } from 'vitest';
import { groupLightSwitched } from './linking';

describe("a group's lights in a scene", () => {
  it('takes one out of all its planets, and back (nothing left: nothing kept)', () => {
    const out = groupLightSwitched(undefined, 'added-sun', false);
    expect(out).toEqual({ 'added-sun': { enabled: false } });
    expect(groupLightSwitched(out, 'added-moon', false)).toEqual({
      'added-sun': { enabled: false },
      'added-moon': { enabled: false },
    });
    expect(groupLightSwitched(out, 'added-sun', true)).toBeUndefined();
  });
});
