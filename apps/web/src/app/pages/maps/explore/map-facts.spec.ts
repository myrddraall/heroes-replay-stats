import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { MapFacts as PackFacts } from '@myrddraall/heroes-replay-stats-map';
import { describe, expect, it } from 'vitest';
import { MapFacts } from './map-facts';
import type { MapExtraInfo, MapPicture } from './map-info';

const facts: PackFacts = {
  id: 'towers-of-doom',
  name: 'Towers of Doom',
  category: 'Battleground',
  gameBuild: 98348,
  tool: 'heroes-capture 0.5.0',
  validated: true,
  sizeCells: [184, 190],
  playable: { left: 10, bottom: 12, right: 174, top: 180 },
  arenas: ['Arena 1'],
  counts: { structures: 60, towns: 6, camps: 4, cores: 2 },
};

const screen: MapPicture = {
  src: 'https://img/screen.webp',
  srcset: 'https://img/screen.webp 1920w, https://img/screen-960w.webp 960w',
  width: 1920,
  height: 1080,
};

const altar: MapPicture = {
  src: 'https://img/altar.webp',
  srcset: 'https://img/altar.webp 200w, https://img/altar-100w.webp 100w',
  width: 200,
  height: 100,
};

const extra: MapExtraInfo = {
  known: true,
  objectives: [{ title: 'Altars', description: 'Capture altars.', icons: [altar] }],
};

@Component({
  imports: [MapFacts],
  template: `<hrs-map-facts
    [facts]="facts"
    [loadingScreen]="screen"
    [extra]="extra()"
    [extraLoading]="loading()"
  />`,
})
class Host {
  readonly facts = facts;
  readonly screen = screen;
  readonly extra = signal<MapExtraInfo | null>(extra);
  readonly loading = signal(false);
}

async function render(x: MapExtraInfo | null, loading = false) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.extra.set(x);
  fixture.componentInstance.loading.set(loading);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('the map facts', () => {
  it("lists the pack's facts and art, and hero-data's objectives", async () => {
    const el = await render(extra);
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
    const rows = [...el.querySelectorAll('.facts__list dt')].map((d) => d.textContent);
    expect(rows).toEqual([
      'Category',
      'Size',
      'Playable area',
      'Structures',
      'Camps',
      'Game build',
    ]);
    expect(text('.facts__list dd:nth-of-type(2)')).toBe('184 × 190 cells');
    expect(text('.facts__list dd:nth-of-type(3)')).toBe('164 × 168 cells, from (10, 12)');
    expect(text('.facts__list dd:nth-of-type(4)')).toBe('60 in 6 towns, 2 cores');
    const art = el.querySelector<HTMLImageElement>('.facts__art')!;
    expect([art.src, art.srcset]).toEqual([screen.src, screen.srcset]);
    expect(art.sizes).toBe('(max-width: 400px) 90vw, 360px'); // the panel's width
    expect(text('.objective__title')).toBe('Altars');
    const icon = el.querySelector<HTMLImageElement>('.objective__icon')!;
    expect([icon.src, icon.srcset]).toEqual([altar.src, altar.srcset]);
    // Drawn 40 px tall, so 80 px wide: the browser takes the version that is sharp at that.
    expect([icon.sizes, icon.style.height]).toEqual(['80px', '40px']);
  });

  it('shows a progress bar while hero-data loads, and a note for a map it does not know', async () => {
    expect((await render(null, true)).querySelector('mat-progress-bar')).not.toBeNull();
    const unknown = await render({ known: false, objectives: [] });
    expect(unknown.querySelector('.facts__hint')!.textContent).toContain('nothing on this map');
  });
});
