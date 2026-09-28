import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HERO_DATA } from '../data/heroes/hero-data';
import { fakeHeroData } from '../data/heroes/hero-data.fake';
import { HeroMinimapIcon } from './hero-minimap-icon';

describe('HeroMinimapIcon', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: HERO_DATA, useValue: fakeHeroData }] });
  });

  it("shows the hero's minimap icon from heroes-images, named for the hero", async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('heroId', 'Barbarian');
    await fixture.whenStable();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toBe(
      'https://cdn.jsdelivr.net/gh/HeroesToolChest/heroes-images@main/heroesimages/heroportraits/storm_ui_minimapicon_heros_femalebarbarian.png',
    );
    expect(img.alt).toBe('Sonya');
  });

  it('shows nothing for a hero the data does not know', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('heroId', 'NotAHero');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
