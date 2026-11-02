import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sprite, type SpritePicture } from './sprite';
import { describe, expect, it } from 'vitest';

@Component({
  imports: [Sprite],
  template: `<img
    [hrsSprite]="picture()"
    [spriteWidth]="width()"
    [spriteHeight]="height()"
    alt="Sonya"
  />`,
})
class Host {
  readonly picture = signal<SpritePicture>({ src: 'https://x.test/sheet.webp', rect: [64, 32, 128, 128] });
  readonly width = signal<number | undefined>(32);
  readonly height = signal<number | undefined>(undefined);
}

const render = (set?: (host: Host) => void): HTMLImageElement => {
  const fixture = TestBed.createComponent(Host);
  set?.(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('img');
};

describe('hrsSprite', () => {
  it("cuts a sheet's picture out of it and scales it to the width asked for", () => {
    const img = render();
    expect(img.getAttribute('src')).toBe('https://x.test/sheet.webp');
    expect(img.getAttribute('alt')).toBe('Sonya');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.style.width).toBe('128px');
    expect(img.style.height).toBe('128px');
    expect(img.style.objectFit).toBe('none');
    expect(img.style.objectPosition).toBe('-64px -32px');
    expect(img.style.getPropertyValue('zoom')).toBe('0.25');
  });

  it('scales to a height instead, for pictures of one height but varied widths', () => {
    const img = render((host) => {
      host.picture.set({ src: 'https://x.test/emotes.webp', rect: [0, 0, 38, 32] });
      host.width.set(undefined);
      host.height.set(28);
    });
    expect(img.style.width).toBe('38px');
    expect(img.style.height).toBe('32px');
    expect(img.style.getPropertyValue('zoom')).toBe(String(28 / 32));
  });

  it('shows a file of its own as it is, sized by the width asked for or the CSS', () => {
    const sized = render((host) => host.picture.set({ src: 'https://x.test/cat.webp' }));
    expect(sized.getAttribute('src')).toBe('https://x.test/cat.webp');
    expect(sized.style.width).toBe('32px');
    expect(sized.style.objectFit).toBe('');
    expect(sized.style.getPropertyValue('zoom')).toBe('');
    const free = render((host) => {
      host.picture.set({ src: 'https://x.test/cat.webp' });
      host.width.set(undefined);
    });
    expect(free.style.width).toBe('');
    expect(free.style.height).toBe('');
  });
});
