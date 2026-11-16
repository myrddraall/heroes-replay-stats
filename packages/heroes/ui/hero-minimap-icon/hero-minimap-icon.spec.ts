import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeroMinimapIcon } from './hero-minimap-icon';

describe('HeroMinimapIcon', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  it('shows the icon it is given, named for the hero, as a portrait in the circle frame', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('picture', { src: 'https://example.test/sonya.png' });
    fixture.componentRef.setInput('name', 'Sonya');
    await fixture.whenStable();
    const img: HTMLImageElement = fixture.nativeElement.querySelector(
      'hrs-circle-frame hrs-portrait img',
    );
    expect(img.getAttribute('src')).toBe('https://example.test/sonya.png');
    expect(img.alt).toBe('Sonya');
  });

  it("shows a picture at the game's scale: its art, 26 of the minimap's 32, filling the inside", async () => {
    const art = async (rect?: [number, number, number, number]) => {
      const fixture = TestBed.createComponent(HeroMinimapIcon);
      fixture.componentRef.setInput('picture', { src: 'https://example.test/sheet.png', rect });
      fixture.componentRef.setInput('name', 'A hero');
      await fixture.whenStable();
      return (fixture.nativeElement.querySelector('.art') as HTMLElement).style.width;
    };
    expect(await art([0, 0, 32, 32])).toBe(`${(32 / 26) * 100}%`);
    // Xal'atath's, 26px with no clear edge
    expect(await art([0, 0, 26, 26])).toBe('100%');
  });

  it('shows the frame empty without a picture', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('name', 'NotAHero');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('hrs-circle-frame')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('img[alt="NotAHero"]')).toBeNull();
  });
});
