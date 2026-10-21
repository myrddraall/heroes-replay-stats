import { describe, expect, it } from 'vitest';
import { clickedState, elementStatesOf, kindOfKey } from '../src/lib/map/element-states';
import { fixturePack } from './fixtures';

const pack = fixturePack('battlefield-of-eternity');
const elements = pack.data.elements!;
const kinds = { structure: 'standing', camp: 'spawned' } as const;

describe('elementStatesOf', () => {
  it("gives every structure and camp its kind's state", () => {
    const states = elementStatesOf(pack, kinds, {});
    expect(Object.keys(states)).toHaveLength(elements.structures.length + elements.camps.length);
    expect(states[`structure-${elements.structures[0]!.id}`]).toBe('standing');
    expect(states[`camp-${elements.camps[0]!.camp}`]).toBe('spawned');
  });

  it('lets one set on its own keep its state, whatever its kind shows', () => {
    const key = `structure-${elements.structures[0]!.id}`;
    const states = elementStatesOf(pack, { ...kinds, structure: 'rubble' }, { [key]: 'off' });
    expect(states[key]).toBe('off');
    expect(states[`structure-${elements.structures[1]!.id}`]).toBe('rubble');
  });

  it('has nothing for a pack without elements', () => {
    expect(elementStatesOf(fixturePack('punisher-arena'), kinds, {})).toEqual({});
  });
});

describe('clicking an element', () => {
  it('knows its kind from its key, and steps it to the next state of that kind', () => {
    expect(kindOfKey('structure-21')).toBe('structure');
    expect(kindOfKey('camp-2')).toBe('camp');
    expect(kindOfKey('hero-3')).toBeNull();
    expect(clickedState('structure-21', 'standing')).toBe('rubble');
    expect(clickedState('camp-2', 'off')).toBe('spawned');
    expect(clickedState('hero-3', 'off')).toBeNull();
  });
});
