import { UrlSegment } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { forgeMatcher } from './forge-matcher';

describe('forgeMatcher', () => {
  it('takes the editor with what it has open in its path', () => {
    const matcher = forgeMatcher('edit-background');
    const at = (path: string) =>
      matcher(
        path.split('/').map((p) => new UrlSegment(p, {})),
        null as never,
        null as never,
      );
    expect(at('edit-background')?.posParams).toBeUndefined();
    expect(at('edit-background')?.consumed).toHaveLength(1);
    const open = at('edit-background/material/edgeLight222-korhal')?.posParams;
    expect([open?.['kind']?.path, open?.['id']?.path]).toEqual(['material', 'edgeLight222-korhal']);
    expect(at('edit-background/planet')).toBeNull();
    const library = at('edit-background/library/planets/korhal')?.posParams;
    expect([library?.['library']?.path, library?.['item']?.path]).toEqual(['planets', 'korhal']);
    expect(at('edit-background/library/planets')?.posParams?.['kind']).toBeUndefined();
    expect(at('edit-background/library/planets/korhal/x')).toBeNull();
    expect(at('play-background')).toBeNull();
    expect(at('replays')).toBeNull();
  });
});
