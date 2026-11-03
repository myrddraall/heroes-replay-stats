import { describe, expect, it } from 'vitest';
import {
  isUnder,
  resolveShellNav,
  type ShellArea,
  type ShellItem,
  type ShellSection,
  type ShellUtilityLink,
} from './shell-nav';

const areas: ShellArea[] = [
  { path: '/game', label: 'Game', family: 'game', order: 10 },
  { path: '/players', label: 'Players', family: 'matches', order: 20 },
  { path: '/matches', label: 'Matches', family: 'matches', order: 10 },
];
const sections: ShellSection[] = [{ area: '/game', label: 'Maps', link: '/game/maps', order: 10 }];
const utilities: ShellUtilityLink[] = [{ label: 'Import', link: '/import', order: 10 }];
const match: ShellItem = {
  under: '/matches',
  label: "Blackheart's Bay",
  link: '/matches/abc',
  sections: [
    { label: 'Score', link: '/matches/abc/score' },
    {
      label: 'Stats',
      link: '/matches/abc/stats',
      children: [
        { label: 'PvP', link: '/matches/abc/stats/pvp' },
        { label: 'Siege', link: '/matches/abc/stats/siege' },
      ],
    },
  ],
};
const map: ShellItem = { under: '/game/maps', label: 'Cursed Hollow', link: '/game/maps/cursed-hollow' };

const labels = (entries: readonly { label: string }[]) => entries.map((e) => e.label);
const active = (entries: readonly { label: string; active: boolean }[]) =>
  entries.filter((e) => e.active).map((e) => e.label);

describe('isUnder', () => {
  it('matches the link itself and paths under it, not ones that only start the same', () => {
    expect(isUnder('/matches', '/matches')).toBe(true);
    expect(isUnder('/matches/abc', '/matches')).toBe(true);
    expect(isUnder('/matches-old', '/matches')).toBe(false);
  });
});

describe('resolveShellNav', () => {
  it('orders the areas by family, then order, and marks where the game family starts', () => {
    const nav = resolveShellNav(areas, sections, utilities, null, '/players');
    expect(nav.areas.map((a) => [a.label, a.breaks, a.active])).toEqual([
      ['Matches', false, false],
      ['Players', false, true],
      ['Game', true, false],
    ]);
    expect(nav.level2).toEqual([]);
    expect(labels(nav.crumbs)).toEqual(['Players']);
  });

  it("gives an open match's sections as level 2, and Stats' sections as level 3", () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/matches/abc/stats/siege?x=1');
    expect(active(nav.areas)).toEqual(['Matches']);
    expect(labels(nav.level2)).toEqual(['Score', 'Stats']);
    expect(active(nav.level2)).toEqual(['Stats']);
    expect(labels(nav.level3)).toEqual(['PvP', 'Siege']);
    expect(active(nav.level3)).toEqual(['Siege']);
    expect(nav.level3Of?.label).toBe('Stats');
    expect(labels(nav.crumbs)).toEqual(['Matches', "Blackheart's Bay", 'Stats', 'Siege']);
  });

  it('has no level 3 on a section without children', () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/matches/abc/score');
    expect(nav.level3).toEqual([]);
    expect(nav.level3Of).toBeNull();
    expect(labels(nav.crumbs)).toEqual(['Matches', "Blackheart's Bay", 'Score']);
  });

  it("shows an area's fixed sections, and a map opened under one in the breadcrumb", () => {
    const list = resolveShellNav(areas, sections, utilities, null, '/game/maps');
    expect(labels(list.level2)).toEqual(['Maps']);
    expect(labels(list.crumbs)).toEqual(['Game', 'Maps']);
    const page = resolveShellNav(areas, sections, utilities, map, '/game/maps/cursed-hollow');
    expect(labels(page.level2)).toEqual(['Maps']);
    expect(page.level3).toEqual([]);
    expect(labels(page.crumbs)).toEqual(['Game', 'Maps', 'Cursed Hollow']);
  });

  it('ignores an item the page shown is not under', () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/matches');
    expect(nav.level2).toEqual([]);
    expect(labels(nav.crumbs)).toEqual(['Matches']);
  });

  it('builds the tree: areas, their sections, the open item where it sits, the current node and its trail', () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/matches/abc/stats/pvp');
    const [matches, , game] = nav.tree;
    expect(matches!.active && !matches!.current).toBe(true);
    const opened = matches!.children[0]!;
    expect(opened.label).toBe("Blackheart's Bay");
    expect(labels(opened.children)).toEqual(['Score', 'Stats']);
    const pvp = opened.children[1]!.children[0]!;
    expect([pvp.label, pvp.current]).toEqual(['PvP', true]);
    expect(labels(game!.children)).toEqual(['Maps']);

    const onMap = resolveShellNav(areas, sections, utilities, map, '/game/maps/cursed-hollow').tree[2]!;
    expect(labels(onMap.children[0]!.children)).toEqual(['Cursed Hollow']);
    expect(onMap.children[0]!.children[0]!.current).toBe(true);
  });

  it('lists the utilities in the tree after the areas, each family starting with a break, and names the one shown', () => {
    const nav = resolveShellNav(areas, sections, utilities, null, '/import');
    expect(nav.tree.map((n) => [n.label, n.breaks])).toEqual([
      ['Matches', false],
      ['Players', false],
      ['Game', true],
      ['Import', true],
    ]);
    expect(nav.tree[3]!.current).toBe(true);
    expect(labels(nav.crumbs)).toEqual(['Import']);
    expect(nav.areas.map((a) => a.label)).toEqual(['Matches', 'Players', 'Game']);
  });
});
