/**
 * The game's text markup (its tooltips' and talents' texts, as heroes-assets keeps them) read
 * into pieces to draw: plain text, coloured or styled runs (`<c val="bfd4fd"
 * hlt-name="#TooltipNumbers">40%</c>`, `<s val="…" hlt-name="StandardTooltipDetails">`), inline
 * icons (`<img path="@UI/StormTalentInTextQuestIcon" width="20" height="22"/>`) and line breaks
 * (`<n/>`), and the per-level scaling heroes-assets' extraction (Heroes Data Parser) marks after a
 * value (`90~~0.04~~`: 4% more each hero level). Runs nest. A tag it doesn't know keeps its text;
 * one left open closes at the end.
 */

/** A run's colour as the markup gives it: one CSS colour, or a gradient's two ends (`ef6e28-ad231e`). */
export interface GameTextColour {
  readonly from: string;
  /** The gradient's other end, top to bottom; null for one colour. */
  readonly to: string | null;
}

export type GameTextPiece =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'break' }
  | {
      readonly kind: 'scaling';
      /** How much the value before it grows each hero level (`0.04`: 4%). */
      readonly perLevel: number;
    }
  | {
      readonly kind: 'icon';
      /** The game's texture path (`@UI/StormTalentInTextQuestIcon`). */
      readonly path: string;
      /** Its size in the game's pixels, as the markup gives it (its text is 18 high); null where not given. */
      readonly width: number | null;
      readonly height: number | null;
    }
  | {
      readonly kind: 'run';
      /** `c` a colour run, `s` a style's. */
      readonly tag: 'c' | 's';
      /** The game's name for its colour or style (`TooltipNumbers`, `StandardTooltipDetails`), without its `#`. */
      readonly name: string | null;
      readonly colour: GameTextColour | null;
      readonly pieces: readonly GameTextPiece[];
    };

const TAG = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
const SCALING = /~~([0-9.]+)~~/g;
const ATTRIBUTE = /([\w-]+)\s*=\s*"([^"]*)"/g;
const HEX = /^[0-9a-f]{6}$/i;
const ENTITIES: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

const decode = (text: string) => text.replace(/&(lt|gt|amp|quot|apos);/g, (_, name: string) => ENTITIES[name]!);

const attributes = (source: string): Record<string, string> =>
  Object.fromEntries([...source.matchAll(ATTRIBUTE)].map(([, name, value]) => [name!.toLowerCase(), value!]));

/** `bfd4fd` as `#bfd4fd`, `ef6e28-ad231e` as a gradient; null for anything else (`ff00`). */
function colourOf(value: string | undefined): GameTextColour | null {
  const ends = value?.split('-') ?? [];
  if (ends.length < 1 || ends.length > 2 || !ends.every((end) => HEX.test(end))) return null;
  return { from: `#${ends[0]!.toLowerCase()}`, to: ends[1] ? `#${ends[1].toLowerCase()}` : null };
}

const sizeOf = (value: string | undefined) => {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface OpenRun {
  readonly tag: 'c' | 's';
  readonly name: string | null;
  readonly colour: GameTextColour | null;
  readonly pieces: GameTextPiece[];
}

/** The pieces of a text in the game's markup. */
export function parseGameText(text: string): GameTextPiece[] {
  const root: GameTextPiece[] = [];
  const open: OpenRun[] = [];
  const into = () => open.at(-1)?.pieces ?? root;
  const close = () => {
    const run = open.pop()!;
    into().push({ kind: 'run', ...run });
  };
  const addPlain = (raw: string) => {
    if (!raw) return;
    const pieces = into();
    const last = pieces.at(-1);
    const decoded = decode(raw);
    if (last?.kind === 'text') pieces[pieces.length - 1] = { kind: 'text', text: last.text + decoded };
    else pieces.push({ kind: 'text', text: decoded });
  };
  // text, with any per-level scaling marks in it
  const addText = (raw: string) => {
    let from = 0;
    for (const mark of raw.matchAll(SCALING)) {
      addPlain(raw.slice(from, mark.index));
      from = mark.index + mark[0].length;
      const perLevel = Number(mark[1]);
      if (Number.isFinite(perLevel)) into().push({ kind: 'scaling', perLevel });
    }
    addPlain(raw.slice(from));
  };

  let at = 0;
  for (const match of text.matchAll(TAG)) {
    addText(text.slice(at, match.index));
    at = match.index + match[0].length;
    const [, closing, rawTag, source, selfClosing] = match;
    const tag = rawTag!.toLowerCase();
    if (tag === 'n' && !closing) {
      into().push({ kind: 'break' });
    } else if (tag === 'img' && !closing) {
      const a = attributes(source!);
      if (a['path']) {
        into().push({ kind: 'icon', path: a['path'], width: sizeOf(a['width']), height: sizeOf(a['height']) });
      }
    } else if (tag === 'c' || tag === 's') {
      if (closing) {
        // closes the innermost run of its tag, and any opened inside it
        const index = open.map((run) => run.tag).lastIndexOf(tag);
        if (index >= 0) while (open.length > index) close();
      } else if (!selfClosing) {
        const a = attributes(source!);
        open.push({
          tag,
          name: a['hlt-name']?.replace(/^#/, '') || null,
          colour: colourOf(a['val']),
          pieces: [],
        });
      }
    }
    // any other tag: dropped, its text kept
  }
  addText(text.slice(at));
  while (open.length) close();
  return root;
}

/** The text alone, without its markup: for an image's alt text or a screen reader's label. */
export function gameTextPlain(pieces: readonly GameTextPiece[]): string {
  return pieces
    .map((piece) =>
      piece.kind === 'text'
        ? piece.text
        : piece.kind === 'break'
          ? '\n'
          : piece.kind === 'run'
            ? gameTextPlain(piece.pieces)
            : piece.kind === 'scaling'
              ? ` ${gameTextScaling(piece.perLevel)}`
              : '',
    )
    .join('');
}

/** A per-level scaling as the extraction's plain text gives it: `(+4% per level)`. */
export function gameTextScaling(perLevel: number): string {
  return `(+${Math.round(perLevel * 1000) / 10}% per level)`;
}
