import { describe, expect, it } from 'vitest';
import type { MapViewModel } from './map-assets';
import { failed, loaded, startLoading } from './pack-entries';

const map = { pack: { map: { id: 'x' } } } as unknown as MapViewModel;

describe('the global store’s pack entries', () => {
  it('marks a pack as loading once, then loaded or failed', () => {
    const loading = startLoading({}, 'x');
    expect(loading).toEqual({ x: { status: 'loading' } });
    expect(startLoading(loading, 'x')).toBe(loading); // asked twice: the first request stands
    expect(loaded(loading, 'x', map)).toEqual({ x: { status: 'ready', map } });
    expect(failed(loading, 'x', 'format 1')).toEqual({ x: { status: 'error', error: 'format 1' } });
  });

  it('keeps the other packs as they are', () => {
    const entries = loaded(startLoading({}, 'a'), 'a', map);
    expect(startLoading(entries, 'b')).toEqual({ ...entries, b: { status: 'loading' } });
  });
});
