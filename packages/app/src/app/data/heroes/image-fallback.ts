import { DestroyRef, DOCUMENT, inject } from '@angular/core';
import { HEROES_IMAGES_BASE } from '@myrddraall/hero-data';

/** GitHub's own copy of heroes-images, the same files the CDN serves. */
export const HEROES_IMAGES_GITHUB_BASE =
  'https://raw.githubusercontent.com/HeroesToolChest/heroes-images/main/heroesimages';

/**
 * Pictures from heroes-images (hero icons, talents, emotes, map previews) come through jsDelivr,
 * which now and then refuses a file it hasn't cached (403, GitHub limiting it), so a few in a
 * table full of them break. Any that fails is loaded from GitHub's own copy instead, once.
 * Called in an injection context; listens for as long as that lives.
 */
export function fallBackToGitHubImages(): void {
  const doc = inject(DOCUMENT);
  const onError = (event: Event): void => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const src = img.currentSrc || img.src;
    if (!src.startsWith(HEROES_IMAGES_BASE)) return;
    img.removeAttribute('srcset');
    img.src = HEROES_IMAGES_GITHUB_BASE + src.slice(HEROES_IMAGES_BASE.length);
  };
  // a failed image's error doesn't bubble: listen as it goes down
  doc.addEventListener('error', onError, true);
  inject(DestroyRef).onDestroy(() => doc.removeEventListener('error', onError, true));
}
