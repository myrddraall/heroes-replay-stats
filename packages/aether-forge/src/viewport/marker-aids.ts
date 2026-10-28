import type { AidDot, AidLine, EditingAid } from '@myrddraall/heroes-replay-stats-aether/aids';
import { cameraOutline, viewPoint } from '@myrddraall/heroes-replay-stats-aether/camera';
import type { SceneCamera } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
import type { MarkerMode } from '../layout/editor-ui.store';
import type { SceneMarker } from './scene-markers';

/** The colours the markers are drawn in, each channel 0 to 1: the glass's edge, and what is selected. */
export interface MarkerColours {
  readonly edge: Vec3;
  readonly selected: Vec3;
}

/** How far ahead of a camera what it sees is outlined, where not given, in the scene's units. */
export const OUTLINE = 12;
/** A marker's width and the gap after it, in pixels (what a nudge moves it by). */
export const MARKER_WIDTH = 32;
/** How near a camera's own place may be to the view's and still be marked (nearer: it is where the view is). */
export const NEAREST = 1;
/** A dot's width in pixels, and hovered or selected (a ring round the marker's icon over it). */
const DOT = 10;
const DOT_OPEN = 34;

/**
 * The markers shown in a mode: all of them, or only the selected thing's (a light's own;
 * otherwise the lights of the body selected).
 */
export function shownMarkers(
  all: readonly SceneMarker[],
  mode: MarkerMode,
): readonly SceneMarker[] {
  if (mode !== 'selected') return all;
  const lightSelected = all.some((m) => m.kind === 'light' && m.selected);
  return all.filter((m) => m.selected || (m.kind === 'light' && !lightSelected));
}

/**
 * The markers drawn in the scene (editing aids, depth tested): a dot for each that can be picked
 * (none for a pole: its name is its marker), grown into a ring round its icon where hovered or
 * selected, then on top; the lines of what is marked (a light selected to its body, a spot's
 * cone's edges, what a camera sees), dashed, solid where selected. A camera where the view is
 * (or behind it) isn't marked: its lines would fill the view.
 */
export function markerAids(
  markers: readonly SceneMarker[],
  mode: MarkerMode,
  hovered: string | null,
  camera: SceneCamera,
  aspect: number,
  colours: MarkerColours,
): EditingAid[] {
  const dots: AidDot[] = [];
  const lines: AidLine[] = [];
  const line = (from: Vec3, to: Vec3, m: SceneMarker) =>
    lines.push({
      shape: 'line',
      from,
      to,
      pixels: m.selected ? 2 : 1.25,
      colour: m.selected ? colours.selected : colours.edge,
      alpha: (m.selected ? 1 : 0.7) * (m.off ? 0.4 : 1),
      dashed: !m.selected,
    });
  for (const m of shownMarkers(markers, mode)) {
    if (m.camera && !viewPoint(camera, aspect, m.at, NEAREST)) continue;
    const lite = m.kind === 'light' && !m.selected;
    if (m.from && !lite) line(m.from, m.at, m);
    if (m.selected) for (const [a, b] of m.lines ?? []) line(a, b, m);
    if (m.camera)
      for (const [a, b] of cameraOutline(m.camera, aspect, m.outline ?? OUTLINE)) line(a, b, m);
    if (m.kind === 'pole') continue;
    const open = m.selected || m.key === hovered;
    dots.push({
      shape: 'dot',
      at: m.at,
      lift: m.lift ?? 0,
      shift: (m.nudge ?? 0) * MARKER_WIDTH,
      pixels: open ? DOT_OPEN : DOT,
      ring: m.selected ? 2 : 1.25,
      colour: m.selected ? colours.selected : colours.edge,
      alpha: (open ? 1 : 0.8) * (m.off ? 0.55 : 1),
      onTop: open,
    });
  }
  return [...lines, ...dots];
}

/** What `withMarkerAids` reads of an editor and its page. */
interface MarkerAidsSource {
  readonly markers: () => readonly SceneMarker[];
  readonly camera: () => SceneCamera | null;
  readonly beams: () => readonly EditingAid[];
}
interface MarkerAidsUi {
  readonly markers: () => MarkerMode;
  readonly hovered: () => string | null;
  readonly aspect: () => number;
  readonly markerColours: () => MarkerColours;
  readonly screenshot: () => boolean;
  readonly browsing: () => boolean;
}

/**
 * The aids an editor's view draws: its beams and its markers' dots and lines (none in a
 * screenshot, in the library's preview, or with the markers off).
 */
export function editorAids(editor: MarkerAidsSource, ui: MarkerAidsUi): readonly EditingAid[] {
  if (ui.markers() === 'none' || ui.screenshot() || ui.browsing()) return [];
  const camera = editor.camera();
  return camera
    ? [
        ...editor.beams(),
        ...markerAids(
          editor.markers(),
          ui.markers(),
          ui.hovered(),
          camera,
          ui.aspect(),
          ui.markerColours(),
        ),
      ]
    : editor.beams();
}
