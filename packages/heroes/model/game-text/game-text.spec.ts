import { describe, expect, it } from 'vitest';
import { gameTextPlain, gameTextScaling, parseGameText } from './game-text';

describe('parseGameText', () => {
  it('reads a colour run, named by the game, in its text', () => {
    expect(
      parseGameText('Increase the Shield amount of Carapace by <c val="bfd4fd" hlt-name="#TooltipNumbers">40%</c>.'),
    ).toEqual([
      { kind: 'text', text: 'Increase the Shield amount of Carapace by ' },
      {
        kind: 'run',
        tag: 'c',
        name: 'TooltipNumbers',
        colour: { from: '#bfd4fd', to: null },
        pieces: [{ kind: 'text', text: '40%' }],
      },
      { kind: 'text', text: '.' },
    ]);
  });

  it('reads line breaks, inline icons (sized as given, attributes run together too) and nested runs', () => {
    const pieces = parseGameText(
      '<img path="@UI/StormTalentInTextQuestIcon" alignment="uppermiddle" color="B48E4C" width="20"height="22" />' +
        '<c val="e4b800">Quest:</c> Gain <s val="bfd4fd" hlt-name="StandardTooltipDetails">Stacks: <c val="ffffff">3</c></s><n/>Reward',
    );
    expect(pieces[0]).toEqual({ kind: 'icon', path: '@UI/StormTalentInTextQuestIcon', width: 20, height: 22 });
    expect(pieces[1]).toMatchObject({ kind: 'run', tag: 'c', name: null, colour: { from: '#e4b800', to: null } });
    expect(pieces[3]).toMatchObject({
      kind: 'run',
      tag: 's',
      name: 'StandardTooltipDetails',
      pieces: [{ kind: 'text', text: 'Stacks: ' }, { kind: 'run', tag: 'c', pieces: [{ kind: 'text', text: '3' }] }],
    });
    expect(pieces.slice(4)).toEqual([{ kind: 'break' }, { kind: 'text', text: 'Reward' }]);
  });

  it("takes a gradient's two ends, and no colour for a value that isn't one", () => {
    const [gradient, odd] = parseGameText('<c val="ef6e28-ad231e">Destroyer</c><c val="ff00">x</c>');
    expect(gradient).toMatchObject({ colour: { from: '#ef6e28', to: '#ad231e' } });
    expect(odd).toMatchObject({ colour: null });
  });

  it('keeps the text of tags it does not know, closes runs left open, and decodes entities', () => {
    expect(parseGameText('<b>Bold</b> &lt;3 <c val="ffffff">open')).toEqual([
      { kind: 'text', text: 'Bold <3 ' },
      { kind: 'run', tag: 'c', name: null, colour: { from: '#ffffff', to: null }, pieces: [{ kind: 'text', text: 'open' }] },
    ]);
  });
});

describe('per-level scaling', () => {
  it('reads the scaling mark after a value, inside its run', () => {
    expect(parseGameText('take <c val="bfd4fd">90~~0.04~~</c> damage')).toEqual([
      { kind: 'text', text: 'take ' },
      {
        kind: 'run',
        tag: 'c',
        name: null,
        colour: { from: '#bfd4fd', to: null },
        pieces: [
          { kind: 'text', text: '90' },
          { kind: 'scaling', perLevel: 0.04 },
        ],
      },
      { kind: 'text', text: ' damage' },
    ]);
    expect(gameTextScaling(0.025)).toBe('(+2.5% per level)');
  });
});

describe('gameTextPlain', () => {
  it('gives the text without its markup', () => {
    expect(gameTextPlain(parseGameText('Heal for <c val="bfd4fd">30%</c>.<n/>Deal 90~~0.04~~'))).toBe(
      'Heal for 30%.\nDeal 90 (+4% per level)',
    );
  });
});
