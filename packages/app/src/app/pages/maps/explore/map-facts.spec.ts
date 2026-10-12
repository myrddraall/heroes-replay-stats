import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { MapFacts as PackFacts } from '@myrddraall/heroes-replay-stats-map';
import { describe, expect, it } from 'vitest';
import { MapFacts } from './map-facts';
import type { MapExtraInfo } from './map-info';

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

const extra: MapExtraInfo = {
  known: true,
  objectives: [
    { title: 'Altars', description: 'Capture altars.', iconUrls: ['https://img/altar.png'] },
  ],
  images: { replayPreview: null, loadingScreen: 'https://img/screen.jpg' },
};

@Component({
  imports: [MapFacts],
  template: `<hrs-map-facts [facts]="facts" [extra]="extra()" [extraLoading]="loading()" />`,
})
class Host {
  readonly facts = facts;
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
  it("lists the pack's facts and hero-data's objectives and art", async () => {
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
    expect(el.querySelector<HTMLImageElement>('.facts__art')!.src).toBe('https://img/screen.jpg');
    expect(text('.objective__title')).toBe('Altars');
    expect(el.querySelector<HTMLImageElement>('.objective__icon')!.src).toBe(
      'https://img/altar.png',
    );
  });

  it('shows a progress bar while hero-data loads, and a note for a map it does not know', async () => {
    expect((await render(null, true)).querySelector('mat-progress-bar')).not.toBeNull();
    const unknown = await render({
      known: false,
      objectives: [],
      images: { replayPreview: null, loadingScreen: null },
    });
    expect(unknown.querySelector('.facts__hint')!.textContent).toContain('nothing on this map');
  });
});
