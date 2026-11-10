import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signalStore } from '@ngrx/signals';
import { describe, expect, it } from 'vitest';
import { withQueryParams } from './query-params';

const Store = signalStore(withQueryParams({ q: '', played: 'any' }));

async function setup(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), Store] });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  return { router, store: TestBed.inject(Store) };
}

describe('withQueryParams', () => {
  it("reads the page's address, defaults for what it leaves out", async () => {
    const { store } = await setup('/?q=sky&other=1');
    expect(store.query()).toEqual({ q: 'sky', played: 'any' });
  });

  it('writes a change into the address, leaving defaults out and other parameters as they are', async () => {
    const { router, store } = await setup('/?other=1&played=week');
    store.setQuery({ q: 'tracer', played: 'any' });
    expect(store.query()).toEqual({ q: 'tracer', played: 'any' });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(router.url).toBe('/?other=1&q=tracer');
  });

  it('follows the address as it changes (back and forward)', async () => {
    const { router, store } = await setup('/');
    await router.navigateByUrl('/?played=today');
    expect(store.query()).toEqual({ q: '', played: 'today' });
  });
});
