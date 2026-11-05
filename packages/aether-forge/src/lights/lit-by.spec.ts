import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MAX_LIGHTS, MAX_SHADES } from '@myrddraall/heroes-replay-stats-aether/render';
import type { LightId } from '@myrddraall/heroes-replay-stats-aether/lights';
import { LitBy } from './lit-by';
import type { LitByEntry } from './lights';

const entry = (n: number, darkens = false, kind: LitByEntry['kind'] = 'point'): LitByEntry => ({
  id: `added-${darkens ? 'd' : 'l'}${n}` as LightId,
  kind,
  name: `Light ${n}`,
  darkens,
  reaches: true,
  enabledBelow: true,
});

describe('LitBy', () => {
  it('says where a body has more lights than it is drawn with (ambient ones add up into one)', async () => {
    const fixture = TestBed.createComponent(LitBy);
    const status = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent?.trim();
    const within = [
      ...Array.from({ length: MAX_LIGHTS }, (_, i) => entry(i)),
      ...Array.from({ length: 3 }, (_, i) => entry(100 + i, false, 'ambient')),
    ];
    fixture.componentRef.setInput('lights', within);
    await fixture.whenStable();
    expect(status()).toBeUndefined();
    fixture.componentRef.setInput('lights', [
      ...within,
      entry(MAX_LIGHTS),
      ...Array.from({ length: MAX_SHADES + 1 }, (_, i) => entry(i, true)),
    ]);
    await fixture.whenStable();
    expect(status()).toBe(
      `Only ${MAX_LIGHTS} of its ${MAX_LIGHTS + 1} lights that light are drawn. ` +
        `Only ${MAX_SHADES} of its ${MAX_SHADES + 1} lights that darken are drawn.`,
    );
  });
});
