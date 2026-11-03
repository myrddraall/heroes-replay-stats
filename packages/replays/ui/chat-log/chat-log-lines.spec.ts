import { createEmoticonSet } from '@myrddraall/hero-data';
import type { ChatLineRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import type { HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { chatLogLines } from './chat-log-lines';

const row = (seq: number, over: Partial<ChatLineRow>): ChatLineRow => ({
  seq,
  gameloop: 0,
  seconds: 0,
  kind: 'chat',
  slot: 0,
  name: 'Erd',
  hero: 'D.Va',
  heroId: 'DVaPilot',
  team: 0,
  text: 'gg',
  point: null,
  ...over,
});

const heroes: Pick<HeroLookup, 'heroDataId'> = {
  heroDataId: (id, name) => (id === 'DVaPilot' || name === 'D.Va' ? 'DVa' : null),
};
const lookup = heroes as HeroLookup;
const images = { emoticon: (e: { image: string }) => ({ src: `img/${e.image}` }) };
const emotes = createEmoticonSet({
  build: 1,
  emoticons: {
    abstract_happy: { aliases: [':)'], expression: 'Happy' },
    dva_happy: { aliases: [':dvahappy:'], heroId: 'DVa', expression: 'Happy', image: 'dva.png' },
  },
});

describe('chatLogLines', () => {
  const rows = [
    row(0, { seconds: 75, text: 'hi :)' }),
    row(1, { kind: 'ping', text: null, point: { x: 1, y: 2 } }),
    row(2, {
      seconds: 3600,
      slot: 5,
      name: 'Other',
      hero: 'Nova',
      heroId: 'Nova',
      team: 1,
      text: 'gg',
    }),
  ];
  const icons = { 0: { picture: { src: 'dva-icon.png' }, name: 'D.Va' } };

  it("lists the chat, not the pings, with the sender's emotes as their hero's", () => {
    const lines = chatLogLines(rows, emotes, lookup, images, icons);
    expect(lines.map((l) => [l.key, l.time, l.sender, l.team])).toEqual([
      [0, '1:15', 'Erd', 0],
      [2, '1:00:00', 'Other', 1],
    ]);
    expect(lines[0]!.icon).toEqual({ picture: { src: 'dva-icon.png' }, name: 'D.Va' });
    expect(lines[1]!.icon).toBeNull();
    expect(lines[0]!.pieces).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'emote', picture: { src: 'img/dva.png' }, code: ':)' },
    ]);
  });

  it('shows the lines as plain text until the emotes have loaded', () => {
    const lines = chatLogLines(rows, null, lookup, images, icons);
    expect(lines[0]!.pieces).toEqual([{ kind: 'text', text: 'hi :)' }]);
  });
});
