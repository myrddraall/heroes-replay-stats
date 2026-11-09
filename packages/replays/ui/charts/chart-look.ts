import type { TeamColor } from '../../model';

/** The colours and font a chart draws with, read from the page's theme. */
export interface ChartLook {
  readonly font: string;
  /** Axis labels and names. */
  readonly label: string;
  /** Grid lines and axis lines. */
  readonly line: string;
  readonly teams: Readonly<Record<TeamColor, string>>;
  /** Further colours a chart's stylesheet sets (`--<name>` custom properties), by name. */
  readonly extra: Readonly<Record<string, string>>;
  /** Colours a chart's stylesheet sets per theme (`readThemedColours`), by theme, then name. */
  readonly themed?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * A chart's colours and font, from the custom properties on `element`: the theme's Material
 * tokens and team colours, and any `extra` custom properties its stylesheet sets. The canvas
 * can't read custom properties, so each is resolved to the `rgba()` it draws.
 */
export function readChartLook(element: HTMLElement, extra: readonly string[] = []): ChartLook {
  const style = getComputedStyle(element);
  const color = colorResolver();
  const read = (property: string) => color(style.getPropertyValue(property).trim());
  return {
    font: style.fontFamily,
    label: read('--mat-sys-on-surface-variant'),
    line: read('--mat-sys-outline-variant'),
    teams: {
      blue: read('--hrs-team-blue'),
      red: read('--hrs-team-red'),
    } satisfies Record<TeamColor, string>,
    extra: Object.fromEntries(extra.map((name) => [name, read(`--${name}`)])),
  };
}

/**
 * Colours a stylesheet sets as custom properties on themed elements (`theme="blue"`…), by each
 * element's theme and then by name (`top` for `--top`): for colours made from a theme's tokens
 * (`color-mix`, relative colours), which only an element in that theme resolves. Each is resolved
 * to the `rgba()` the canvas draws.
 */
export function readThemedColours(
  elements: readonly HTMLElement[],
  names: readonly string[],
): Record<string, Record<string, string>> {
  const color = colorResolver();
  return Object.fromEntries(
    elements.map((element) => {
      const read = (name: string) => {
        element.style.color = `var(--${name})`;
        return color(getComputedStyle(element).color);
      };
      const colours = Object.fromEntries(names.map((name) => [name, read(name)]));
      element.style.color = '';
      return [element.getAttribute('theme') ?? '', colours];
    }),
  );
}

/** Resolves any CSS colour (oklch, a named colour…) to `rgba()` by painting it on a pixel. */
function colorResolver(): (css: string) => string {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  return (css) => {
    if (!context || !css) return css;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${((a ?? 255) / 255).toFixed(3)})`;
  };
}
