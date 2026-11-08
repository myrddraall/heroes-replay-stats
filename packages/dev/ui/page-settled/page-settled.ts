import { afterRenderEffect, DestroyRef, inject } from '@angular/core';

/**
 * Calls `then` once, when the element is there (read in a signal, such as a `viewChild`, so one
 * that comes with data is waited for) and the page has settled around it: the fonts loaded (on a
 * full load they reflow the page), its entrance animations done (pages slide in; endless ones
 * aside) and the element laid out. For a showcase opening a tooltip by itself: placed before that,
 * the tooltip would stay where its element was. In an injection context (a component's
 * constructor).
 */
export function afterPageSettles(element: () => HTMLElement | undefined, then: () => void): void {
  const destroyRef = inject(DestroyRef);
  let started = false;
  afterRenderEffect(() => {
    const target = element();
    if (!target || started) return;
    started = true;
    void (async () => {
      await document.fonts.ready;
      const finite = document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
      await Promise.allSettled(finite.map((a) => a.finished));
      if (destroyRef.destroyed) return;
      const observer = new ResizeObserver(([entry]) => {
        if (!entry || entry.contentRect.height === 0) return;
        observer.disconnect();
        then();
      });
      observer.observe(target);
      destroyRef.onDestroy(() => observer.disconnect());
    })();
  });
}
