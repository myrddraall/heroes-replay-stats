import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ANY_MATCH, type MatchFilter, type MatchOptions } from '../../model';
import { MatchFilters } from './match-filters';

const options: MatchOptions = {
  maps: ['Cursed Hollow', 'Sky Temple'],
  modes: ['quick-match', 'storm-league'],
  heroes: ['Tracer'],
};

async function render(opts: MatchOptions, filter: MatchFilter = ANY_MATCH) {
  const fixture = TestBed.createComponent(MatchFilters);
  fixture.componentRef.setInput('options', opts);
  fixture.componentRef.setInput('filter', filter);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('MatchFilters', () => {
  it('offers map, mode and your hero, and the hero only when the matches know who you are', async () => {
    const labels = (el: HTMLElement) =>
      [...el.querySelectorAll('mat-label')].map((l) => l.textContent?.trim());
    expect(labels((await render(options)).el)).toEqual(['Map', 'Mode', 'Your hero']);
    expect(labels((await render({ ...options, heroes: [] })).el)).toEqual(['Map', 'Mode']);
  });

  it('searches as you type, and Escape clears the search', async () => {
    const { fixture, el } = await render(options);
    const field = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    field.value = 'tracer';
    field.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.filter().text).toBe('tracer');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.filter().text).toBe('');
  });

  it('shows Clear only while something is chosen, and it chooses nothing', async () => {
    const { fixture, el } = await render(options);
    expect(el.querySelector('.filters__clear')).toBeNull();
    fixture.componentRef.setInput('filter', { ...ANY_MATCH, map: 'Sky Temple', played: 'week' });
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.filters__clear')!.click();
    expect(fixture.componentInstance.filter()).toEqual(ANY_MATCH);
  });
});
