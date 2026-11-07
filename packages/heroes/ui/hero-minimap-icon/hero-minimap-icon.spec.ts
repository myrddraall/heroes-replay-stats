import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeroMinimapIcon } from './hero-minimap-icon';

describe('HeroMinimapIcon', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  it('shows the icon it is given, named for the hero', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('picture', { src: 'https://example.test/sonya.png' });
    fixture.componentRef.setInput('name', 'Sonya');
    await fixture.whenStable();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.icon img');
    expect(img.getAttribute('src')).toBe('https://example.test/sonya.png');
    expect(img.alt).toBe('Sonya');
  });

  it('shows the icon in the hero frame', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('picture', { src: 'https://example.test/sonya.png' });
    fixture.componentRef.setInput('name', 'Sonya');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('hrs-hero-frame img[alt="Sonya"]')).not.toBeNull();
  });

  it("shows a picture at the game's scale, its width over the minimap's 32px", async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('picture', { src: 'https://example.test/sheet.png', rect: [0, 0, 26, 26] });
    fixture.componentRef.setInput('name', 'Xalatath');
    await fixture.whenStable();
    const art: HTMLElement = fixture.nativeElement.querySelector('.icon__art');
    expect(art.style.fontSize).toBe(`${26 / 32}em`);
  });

  it('shows the frame empty without a picture', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('name', 'NotAHero');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('hrs-hero-frame')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('img[alt="NotAHero"]')).toBeNull();
  });
});
