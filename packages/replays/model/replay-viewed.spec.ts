import { describe, expect, it } from 'vitest';
import { replayViewed } from './replay-viewed';

describe('replayViewed', () => {
  it('is new until opened, viewed after, and updated once imported again', () => {
    const imported = '2024-06-02T09:15:00.000Z';
    expect(replayViewed(imported, undefined)).toBe('new');
    expect(replayViewed(imported, imported)).toBe('viewed');
    expect(replayViewed('2024-07-01T00:00:00.000Z', imported)).toBe('updated');
  });
});
