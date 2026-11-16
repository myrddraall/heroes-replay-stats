import type { EmoticonSet, HeroesImages, Picture } from '@myrddraall/hero-data';
import type { ChatLineRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { formatDuration } from '../replay-list-item/replay-list-item';

/** A piece of a chat line as the log shows it: text, or an emote's picture. */
export type ChatLogPiece =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'emote'; readonly picture: Picture; readonly code: string };

/** One chat line as the log shows it. */
export interface ChatLogLine {
  readonly key: number;
  /** When in the game, `m:ss`. */
  readonly time: string;
  readonly sender: string | null;
  readonly hero: string | null;
  readonly team: Team | null;
  readonly icon: HeroIcon | null;
  readonly pieces: readonly ChatLogPiece[];
}

/**
 * The chat lines (not the pings) of a replay, with each line's emote codes as the emotes the
 * sender's game showed; as plain text until the emotes have loaded (`emotes` null).
 */
export function chatLogLines(
  rows: readonly ChatLineRow[],
  emotes: EmoticonSet | null,
  heroes: HeroLookup,
  images: Pick<HeroesImages, 'emoticon'>,
  icons: Readonly<Record<number, HeroIcon | null>>,
): ChatLogLine[] {
  return rows
    .filter((r) => r.kind === 'chat' && r.text !== null)
    .map((r) => {
      const text = r.text ?? '';
      const heroId = r.heroId === null ? null : heroes.heroDataId(r.heroId, r.hero ?? undefined);
      return {
        key: r.seq,
        time: formatDuration(r.seconds),
        sender: r.name,
        hero: r.hero,
        team: r.team,
        icon: r.slot === null ? null : (icons[r.slot] ?? null),
        pieces: emotes
          ? emotes
              .parse(text, heroId)
              .map((p) =>
                p.kind === 'text'
                  ? p
                  : { kind: 'emote' as const, picture: images.emoticon(p.emoticon), code: p.code },
              )
          : [{ kind: 'text', text }],
      };
    });
}
