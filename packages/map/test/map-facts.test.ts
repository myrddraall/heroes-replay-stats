import { describe, expect, it } from 'vitest';
import { mapFactsOf } from '../src/lib/pack/map-facts';
import { fixturePack } from './fixtures';

describe('the facts of a map', () => {
  it('come from the pack: its identity, size, playable area and what it has on it', () => {
    const facts = mapFactsOf(fixturePack('battlefield-of-eternity'));
    expect(facts.name).toBe('Battlefield of Eternity');
    expect(facts.category).toBe('Battleground');
    expect(facts.gameBuild).toBe(98348);
    expect(facts.sizeCells).toEqual([248, 208]);
    expect(facts.playable).toEqual({ left: 20, bottom: 28, right: 228, top: 178 });
    expect(facts.arenas).toEqual(['Arena 1']);
    expect(facts.counts).toEqual({ structures: 72, towns: 8, camps: 4, cores: 2 });
  });

  it('count nothing on a map without an elements render, and list its arenas', () => {
    const facts = mapFactsOf(fixturePack('punisher-arena'));
    expect(facts.counts).toEqual({ structures: 0, towns: 0, camps: 0, cores: 0 });
    expect(facts.arenas.length).toBe(3);
  });
});
