import { DestroyRef, effect, inject } from '@angular/core';
import { type FrameDetail, FrameStats } from '@myrddraall/heroes-replay-stats-aether/view';
import { DEV_REPORTS_URL, DevReports } from './dev-reports';

/** How many of the stats' windows the report keeps (a minute of drawing). */
const KEPT = 120;

/**
 * The background's frame stats, while anything shows them (an editor's), sent where dev reports go
 * as `frame-stats`: a line every time they are given with frames drawn, the last minute's kept, for
 * finding what is slow on the machine the app runs on. Called in an injection context.
 */
export function reportFrameStats(): void {
  if (!inject(DEV_REPORTS_URL)) return;
  const stats = inject(FrameStats);
  const reports = inject(DevReports);
  const lines: string[] = [];
  const keep = (line: string) => {
    lines.push(line);
    if (lines.length > KEPT) lines.splice(0, lines.length - KEPT);
  };
  // The page's long frames while the stats show (Chrome's long animation frames): what held each
  // one up on the main thread, its scripts and its style and layout.
  if (
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
  ) {
    const observer = new PerformanceObserver((list) => {
      if (!stats.watching()) return;
      for (const entry of list.getEntries() as LongFrame[]) keep(longFrameText(entry));
    });
    observer.observe({ type: 'long-animation-frame' });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
  effect(() => {
    const s = stats.current();
    const d = stats.detail();
    if (!s || !d) return;
    keep(
      [
        new Date().toISOString().slice(11, 23),
        `${s.fps.toFixed(1)} fps`,
        `cpu ${s.ms.toFixed(1)} ms`,
        `gpu ${s.gpuMs === null ? '-' : s.gpuMs.toFixed(1)} ms`,
        sectionsText(d),
      ].join('  '),
    );
    reports.send('frame-stats', lines.join('\n'));
  });
}

const sectionsText = (d: FrameDetail) =>
  [
    `${d.backend} ${d.width}x${d.height}`,
    `frames ${d.frames} moves ${d.moves} gap ${d.longestGap.toFixed(0)} ms`,
    `still ${d.stillFrames}x ${d.still.toFixed(1)}`,
    `bakes ${d.baked.toFixed(1)} ${d.bakes.toFixed(1)} resized ${d.resized.toFixed(2)}`,
    `passes ${d.passes.toFixed(1)}`,
    `post ${d.post.toFixed(1)}`,
    `renders ${d.renders.toFixed(0)} calls ${d.calls.toFixed(0)}`,
    `pipelines ${d.pipelines} textures ${d.textures} (${d.textureMb.toFixed(0)} MB)`,
  ].join('  ');

/** A long animation frame as Chrome gives it (not yet in the DOM's types). */
interface LongFrame extends PerformanceEntry {
  readonly renderStart: number;
  readonly styleAndLayoutStart: number;
  readonly blockingDuration: number;
  readonly scripts: readonly {
    readonly invoker: string;
    readonly sourceURL: string;
    readonly sourceFunctionName: string;
    readonly duration: number;
    readonly forcedStyleAndLayoutDuration: number;
  }[];
}

/** A long frame in a line: how long, its style and layout, and its longest scripts with where they are. */
function longFrameText(e: LongFrame): string {
  const end = e.startTime + e.duration;
  const layout = e.styleAndLayoutStart ? end - e.styleAndLayoutStart : 0;
  const render = e.renderStart ? end - e.renderStart : 0;
  const scripts = [...e.scripts]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 4)
    .map(
      (s) =>
        `${s.duration.toFixed(0)} ms ${s.invoker} ${s.sourceFunctionName || '?'} ` +
        `${s.sourceURL.split('/').pop()?.split('?')[0] ?? ''}` +
        (s.forcedStyleAndLayoutDuration
          ? ` (forced layout ${s.forcedStyleAndLayoutDuration.toFixed(0)} ms)`
          : ''),
    );
  return [
    `  long frame ${e.duration.toFixed(0)} ms`,
    `render ${render.toFixed(0)} style+layout ${layout.toFixed(0)}`,
    ...scripts,
  ].join('  |  ');
}
