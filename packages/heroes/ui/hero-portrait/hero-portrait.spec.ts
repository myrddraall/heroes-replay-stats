import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeroPortrait } from './hero-portrait';

describe('HeroPortrait', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  it('shows the portrait it is given, named for the hero', async () => {
    const fixture = TestBed.createComponent(HeroPortrait);
    fixture.componentRef.setInput('picture', { src: 'https://example.test/sonya.png' });
    fixture.componentRef.setInput('name', 'Sonya');
    await fixture.whenStable();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://example.test/sonya.png');
    expect(img.alt).toBe('Sonya');
  });

  it('shows nothing without a picture', async () => {
    const fixture = TestBed.createComponent(HeroPortrait);
    fixture.componentRef.setInput('name', 'Sonya');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
