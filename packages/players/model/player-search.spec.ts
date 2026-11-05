import { describe, expect, it } from 'vitest';
import { nameFits } from './player-search';

describe('nameFits', () => {
  it('keeps everyone for an empty search', () => {
    expect(nameFits('Erd', '')).toBe(true);
    expect(nameFits('Erd', '   ')).toBe(true);
  });

  it('needs every word in the name, any case', () => {
    expect(nameFits('TwilightNova', 'nova')).toBe(true);
    expect(nameFits('TwilightNova', 'TWI nova')).toBe(true);
    expect(nameFits('TwilightNova', 'nova erd')).toBe(false);
  });
});
