import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HEROES_IMAGES_BASE } from '@myrddraall/hero-data';
import { describe, expect, it } from 'vitest';
import { fallBackToGitHubImages, HEROES_IMAGES_GITHUB_BASE } from './image-fallback';

@Component({ selector: 'hrs-host', template: '' })
class Host {
  constructor() {
    fallBackToGitHubImages();
  }
}

const failed = (src: string): HTMLImageElement => {
  const img = document.createElement('img');
  img.setAttribute('src', src);
  img.setAttribute('srcset', `${src} 1x`);
  document.body.appendChild(img);
  img.dispatchEvent(new Event('error'));
  return img;
};

describe('fallBackToGitHubImages', () => {
  it("loads a heroes-images picture that failed from GitHub's copy instead", () => {
    TestBed.createComponent(Host);
    const img = failed(`${HEROES_IMAGES_BASE}/abilitytalents/storm_ui_icon_cho_runebomb.png`);
    expect(img.getAttribute('src')).toBe(
      `${HEROES_IMAGES_GITHUB_BASE}/abilitytalents/storm_ui_icon_cho_runebomb.png`,
    );
    expect(img.hasAttribute('srcset')).toBe(false);
    img.remove();
  });

  it('leaves other pictures, and GitHub copies that fail too, as they are', () => {
    TestBed.createComponent(Host);
    const other = failed('https://example.com/a.png');
    expect(other.getAttribute('src')).toBe('https://example.com/a.png');
    const copy = failed(`${HEROES_IMAGES_GITHUB_BASE}/emoticons/a.png`);
    expect(copy.getAttribute('src')).toBe(`${HEROES_IMAGES_GITHUB_BASE}/emoticons/a.png`);
    other.remove();
    copy.remove();
  });
});
