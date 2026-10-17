import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HeroMinimapIcon } from './hero-minimap-icon';

describe('HeroMinimapIcon', () => {
  it('shows the icon it is given, named for the hero', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('src', 'https://example.test/sonya.png');
    fixture.componentRef.setInput('name', 'Sonya');
    await fixture.whenStable();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://example.test/sonya.png');
    expect(img.alt).toBe('Sonya');
  });

  it('shows nothing without a picture', async () => {
    const fixture = TestBed.createComponent(HeroMinimapIcon);
    fixture.componentRef.setInput('name', 'NotAHero');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
