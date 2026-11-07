import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { heroesImages, type HeroData } from '@myrddraall/hero-data';
import type { ChatLineRow } from '@myrddraall/heroprotocol-analysis';
import { heroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ReplayStatsService } from '../../data';
import { ReplayPageStore } from '../replay-page';
import { ChatSectionStore } from './chat-section.store';

const line: ChatLineRow = {
  seq: 1,
  gameloop: 0,
  seconds: 12,
  kind: 'chat',
  slot: null,
  name: 'Ann',
  hero: null,
  heroId: null,
  team: 0,
  text: 'gg :aplausos:',
  point: null,
};

describe('ChatSectionStore', () => {
  it("shows a line's emotes only once the hero data has loaded", async () => {
    const heroData = signal<HeroData | null>(null);
    TestBed.configureTestingModule({
      providers: [
        ChatSectionStore,
        {
          provide: ReplayPageStore,
          useValue: {
            replayId: signal('r1'),
            heroData,
            images: signal(heroesImages()),
            heroes: signal(heroLookup(undefined, heroesImages())),
            icons: signal({}),
          },
        },
        { provide: ReplayStatsService, useValue: { chat: () => of([line]) } },
      ],
    });
    const store = TestBed.inject(ChatSectionStore);
    await TestBed.inject(ApplicationRef).whenStable();
    // the emotes have loaded by now: nothing is awaited between this and the emote showing
    expect(store.lines()?.[0]?.pieces).toEqual([{ kind: 'text', text: 'gg :aplausos:' }]);

    heroData.set({} as HeroData);
    expect(store.lines()?.[0]?.pieces.map((p) => p.kind)).toEqual(['text', 'emote']);
  });
});
