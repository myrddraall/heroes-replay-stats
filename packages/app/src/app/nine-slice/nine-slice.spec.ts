import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { SheetMeta } from '../sheet/read-sheet';
import { SheetStore, type PictureStatus } from '../sheet/sheet.store';
import { NineSlice, type SliceSource } from './nine-slice';

const META: SheetMeta = {
  v: 1,
  frames: {
    back: { states: { normal: [0, 0, 40, 40] }, cuts: [10, 10, 10, 10], edges: 'tile' },
    border: {
      states: { normal: [0, 40, 30, 30], hover: [0, 70, 30, 30] },
      cuts: [6, 8, 6, 8],
      centre: 'none',
    },
  },
  sets: { card: { back: 'back', front: 'border' } },
};

/** A store with every picture already loaded, and pieces named after their place. */
function fakeStore() {
  const pictures = signal<Record<string, PictureStatus>>({});
  return {
    load: vi.fn((url: string) =>
      pictures.update((p) => p[url] ? p : ({
        ...p,
        [url]: {
          status: 'ready',
          picture: { url: `blob:${url}`, width: 64, height: 128, meta: url.endsWith('.webp') ? META : null },
        },
      })),
    ),
    status: (url: string) => pictures()[url],
    sheetUrl: (sheet: string) => `/sheets/${sheet}.webp`,
    piece: vi.fn(async (_url: string, cut: { rect: readonly number[] }) => `blob:piece-${cut.rect.join('-')}`),
  };
}

@Component({
  imports: [NineSlice],
  template: `<div [hrsSlice]="set()" [hrsSliceBack]="back()" [hrsSliceFront]="front()">
    <p>content</p>
  </div>`,
})
class Host {
  readonly set = signal<string | undefined>(undefined);
  readonly back = signal<SliceSource | undefined>(undefined);
  readonly front = signal<SliceSource | undefined>(undefined);
}

async function setUp() {
  const store = fakeStore();
  TestBed.configureTestingModule({ providers: [{ provide: SheetStore, useValue: store }] });
  const fixture = TestBed.createComponent(Host);
  const host = fixture.componentInstance;
  const el = () => fixture.nativeElement.querySelector('div') as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  };
  return { store, fixture, host, el, settle };
}

describe('NineSlice', () => {
  it("draws a set's frames around the content: the back first, the front last", async () => {
    const { host, el, settle, store } = await setUp();
    host.set.set('ui#card');
    await settle();
    expect(store.load).toHaveBeenCalledWith('/sheets/ui.webp');
    const children = [...el().children];
    expect(children.map((c) => c.className)).toEqual([
      'hrs-slice hrs-slice--back',
      '',
      'hrs-slice hrs-slice--front',
    ]);
    for (const layer of [children[0]!, children[2]!]) {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      expect(layer.querySelectorAll('.hrs-slice__part')).toHaveLength(9);
    }
  });

  it('sizes the grid from the cuts, pads the content to the front frame and keeps the corners', async () => {
    const { host, el, settle } = await setUp();
    host.set.set('ui#card');
    await settle();
    const front = el().querySelector('.hrs-slice--front') as HTMLElement;
    expect(front.style.gridTemplateColumns).toBe('8px 1fr 8px');
    expect(front.style.gridTemplateRows).toBe('6px 1fr 6px');
    expect(el().style.padding).toBe('6px 8px');
    expect(el().style.minWidth).toBe('20px');
    expect(el().style.minHeight).toBe('20px');
  });

  it("hands each part its pieces for every state, and leaves an empty centre out", async () => {
    const { host, el, settle } = await setUp();
    host.set.set('ui#card');
    await settle();
    const parts = el().querySelectorAll<HTMLElement>('.hrs-slice--front .hrs-slice__part');
    const topLeft = parts[0]!;
    expect(topLeft.style.getPropertyValue('--hrs-slice-normal')).toBe('url("blob:piece-0-40-8-6")');
    expect(topLeft.style.getPropertyValue('--hrs-slice-hover')).toBe('url("blob:piece-0-70-8-6")');
    expect(parts[4]!.classList).toContain('hrs-slice__part--empty');

    const backTop = el().querySelectorAll<HTMLElement>('.hrs-slice--back .hrs-slice__part')[1]!;
    expect(backTop.style.getPropertyValue('--hrs-slice-repeat')).toBe('repeat no-repeat');
    expect(backTop.style.getPropertyValue('--hrs-slice-size')).toBe('20px 100%');
  });

  it('takes a frame given in the template, and drops a layer whose frame goes', async () => {
    const { host, el, settle } = await setUp();
    host.back.set({ picture: { src: '/art/panel.png' }, cuts: [16, 16, 16, 16], mirror: 'x', tint: 'red' });
    await settle();
    const back = el().querySelector('.hrs-slice--back') as HTMLElement;
    expect(back.style.gridTemplateColumns).toBe('16px 1fr 16px');
    expect(back.classList).toContain('hrs-slice--tint');
    expect(back.style.getPropertyValue('--hrs-slice-tint')).toBe('red');
    expect((back.children[2] as HTMLElement).style.scale).toBe('-1 1');
    // a frame behind doesn't pad unless asked
    expect(el().style.padding).toBe('');

    host.back.set(undefined);
    await settle();
    expect(el().querySelector('.hrs-slice')).toBeNull();
  });

  it('marks the element so the CSS can switch states, with a state it can’t see', async () => {
    const { host, el, settle } = await setUp();
    host.set.set('ui#card');
    await settle();
    expect(el().hasAttribute('data-hrs-slice')).toBe(true);
    expect(el().style.isolation).toBe('isolate');
  });
});
