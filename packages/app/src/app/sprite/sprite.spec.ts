import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SheetStore, type PictureStatus } from '../sheet/sheet.store';
import { Sprite, type SpritePicture } from './sprite';

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

@Component({
  imports: [Sprite],
  template: `<img [hrsSprite]="name()" [spriteWidth]="16" [loading]="loading()" alt="" />`,
})
class Named {
  readonly name = signal('ui#gear');
  readonly loading = signal<'lazy' | 'eager'>('eager');
}

/** A store whose sheets load at once, each holding a gear at [24, 8, 32, 32]. */
function fakeStore() {
  const pictures = signal<Record<string, PictureStatus>>({});
  return {
    load: vi.fn((url: string) =>
      pictures.update((p) =>
        p[url]
          ? p
          : {
              ...p,
              [url]: {
                status: 'ready',
                picture: {
                  url: `blob:${url}`,
                  width: 64,
                  height: 64,
                  meta: { v: 1, frames: {}, sets: {}, pictures: { gear: [24, 8, 32, 32] } },
                },
              },
            },
      ),
    ),
    status: (url: string) => pictures()[url],
    sheetUrl: (sheet: string) => `/sheets/${sheet}.webp`,
  };
}

describe('hrsSprite by name', () => {
  const setUp = async (set?: (host: Named) => void) => {
    const store = fakeStore();
    TestBed.configureTestingModule({ providers: [{ provide: SheetStore, useValue: store }] });
    const fixture = TestBed.createComponent(Named);
    set?.(fixture.componentInstance);
    await fixture.whenStable();
    return { store, img: fixture.nativeElement.querySelector('img') as HTMLImageElement };
  };

  it("shows a sheet's picture by its name, as it would an object", async () => {
    const { store, img } = await setUp();
    expect(store.load).toHaveBeenCalledWith('/sheets/ui.webp');
    expect(img.getAttribute('src')).toBe('blob:/sheets/ui.webp');
    expect(img.style.width).toBe('32px');
    expect(img.style.objectPosition).toBe('-24px -8px');
    expect(img.style.getPropertyValue('zoom')).toBe('0.5');
  });

  it('loads a lazy sheet only once the image nears the viewport', async () => {
    let seen: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          seen = callback;
        }
        readonly observe = vi.fn();
        readonly disconnect = vi.fn();
      },
    );
    try {
      const store = fakeStore();
      TestBed.configureTestingModule({ providers: [{ provide: SheetStore, useValue: store }] });
      const fixture = TestBed.createComponent(Named);
      fixture.componentInstance.loading.set('lazy');
      await fixture.whenStable();
      expect(store.load).not.toHaveBeenCalled();
      seen!([{ isIntersecting: true }]);
      await fixture.whenStable();
      expect(store.load).toHaveBeenCalledWith('/sheets/ui.webp');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows nothing for a name its sheet lacks', async () => {
    const { img } = await setUp((host) => host.name.set('ui#nothing'));
    expect(img.hasAttribute('src')).toBe(false);
  });
});
