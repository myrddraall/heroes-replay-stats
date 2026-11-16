import { describe, expect, it } from 'vitest';
import type { SceneBody } from './scene-settings';
import { changeSettings, planetSettingsOf } from './scene-bodies';
import { withOverlaySwitched, setOverlays, resetOverlays } from './body-overlays';

describe('the overlays a body wears', () => {
  const korhal = { id: 'korhal', position: [0, 0, 0], radius: 1 } as const;

  it('keeps what was set on a planet when another overlay is put on, and takes the old style off', () => {
    // Kept before a planet had one set whatever it wears: those for what it wears now.
    let bodies: readonly SceneBody[] = [
      { ...korhal, style: 'nexus', variants: { nexus: { lighting: 2 }, '': { shade: 1 } } },
    ];
    bodies = setOverlays(bodies, ['0'], ['nexus', 'clouds'], 'nexus');
    expect(bodies[0]).toEqual({
      ...korhal,
      overlays: ['nexus', 'clouds'],
      settings: { lighting: 2 },
    });
    // What it wears back as its own: its settings kept, nothing chosen.
    bodies = resetOverlays(bodies, ['0'], 'nexus+clouds', []);
    expect(bodies[0]).toEqual({ ...korhal, settings: { lighting: 2 } });
  });

  it('keeps one set of settings for a planet whatever it wears, one kept before read for what it wears', () => {
    const kept: SceneBody = { ...korhal, variants: { nexus: { lighting: 2 }, '': { shade: 1 } } };
    expect(planetSettingsOf(kept, 'nexus')).toEqual({ lighting: 2 });
    expect(planetSettingsOf(kept, '')).toEqual({ shade: 1 });
    // Changed: set once, the old sets gone; the same whatever it wears from then on.
    const [changed] = changeSettings([kept], ['0'], '', (s) => ({
      ...s,
      tint: { colour: '#ff0000', blend: 'multiply', strength: 1 },
    }));
    expect(changed).toEqual({
      ...korhal,
      settings: { shade: 1, tint: { colour: '#ff0000', blend: 'multiply', strength: 1 } },
    });
    expect(planetSettingsOf(changed!, 'nexus')).toEqual(changed!.settings);
    // Nothing left set: none.
    expect(changeSettings([changed!], ['0'], 'nexus', () => ({}))[0]).toEqual(korhal);
  });

  it('switches an overlay on or off at the level edited, nothing set where that is as under it', () => {
    expect(withOverlaySwitched({}, 'nexus', false, true)).toEqual({
      overlaysEnabled: { nexus: false },
    });
    expect(
      withOverlaySwitched({ overlaysEnabled: { nexus: false } }, 'nexus', true, true),
    ).toBeUndefined();
  });
});
