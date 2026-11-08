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
  { path: '/about', label: 'About', order: 30 },
  { path: '/game-info', label: 'Game Info', order: 20 },
  { path: '/replays', label: 'Replays', order: 10 },
];
const sections: ShellSection[] = [
  { area: '/replays', label: 'Players', link: '/replays/players', order: 20 },
  { area: '/replays', label: 'Matches', link: '/replays/matches', order: 10 },
  { area: '/replays', label: 'Maps', link: '/replays/maps', order: 30, disabled: true },
  { area: '/game-info', label: 'Maps', link: '/game-info/maps', order: 10 },
];
const utilities: ShellUtilityLink[] = [{ label: 'Import', link: '/import', order: 10 }];
const match: ShellItem = {
  under: '/replays/matches',
  label: "Blackheart's Bay",
  link: '/replays/matches/abc',
  sections: [
    { label: 'Score', link: '/replays/matches/abc/score' },
    {
      label: 'Stats',
      link: '/replays/matches/abc/stats',
      children: [
        { label: 'PvP', link: '/replays/matches/abc/stats/pvp' },
        { label: 'Siege', link: '/replays/matches/abc/stats/siege' },
      ],
    },
  ],
};
const map: ShellItem = {
  under: '/game-info/maps',
  label: 'Cursed Hollow',
  link: '/game-info/maps/cursed-hollow',
};

const labels = (entries: readonly { label: string }[]) => entries.map((e) => e.label);
const active = (entries: readonly { label: string; active: boolean }[]) =>
  entries.filter((e) => e.active).map((e) => e.label);

describe('isUnder', () => {
  it('matches the link itself and paths under it, not ones that only start the same', () => {
    expect(isUnder('/replays', '/replays')).toBe(true);
    expect(isUnder('/replays/matches', '/replays')).toBe(true);
    expect(isUnder('/replays-old', '/replays')).toBe(false);
  });
});

describe('resolveShellNav', () => {
  it("orders the areas and the area's sections, a disabled section shown but never active", () => {
    const nav = resolveShellNav(areas, sections, utilities, null, '/replays/players');
    expect(nav.areas.map((a) => [a.label, a.active])).toEqual([
      ['Replays', true],
      ['Game Info', false],
      ['About', false],
    ]);
    expect(nav.level2.map((s) => [s.label, s.active, s.disabled ?? false])).toEqual([
      ['Matches', false, false],
      ['Players', true, false],
      ['Maps', false, true],
    ]);
    expect(nav.level3).toEqual([]);
    expect(labels(nav.crumbs)).toEqual(['Replays', 'Players']);
  });

  it("keeps the area's sections on level 2 in a match, its sections as level 3 with Stats' as sub-items", () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/replays/matches/abc/stats/siege?x=1');
    expect(active(nav.areas)).toEqual(['Replays']);
    expect(labels(nav.level2)).toEqual(['Matches', 'Players', 'Maps']);
    expect(active(nav.level2)).toEqual(['Matches']);
    expect(labels(nav.level3)).toEqual(['Score', 'Stats']);
    expect(active(nav.level3)).toEqual(['Stats']);
    expect(labels(nav.level3[1]!.children)).toEqual(['PvP', 'Siege']);
    expect(active(nav.level3[1]!.children)).toEqual(['Siege']);
    expect(nav.level3Of?.label).toBe("Blackheart's Bay");
    expect(labels(nav.crumbs)).toEqual(['Replays', 'Matches', "Blackheart's Bay", 'Stats', 'Siege']);
  });

  it('gives a section without children no sub-items', () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/replays/matches/abc/score');
    expect(nav.level3[0]!.children).toEqual([]);
    expect(labels(nav.crumbs)).toEqual(['Replays', 'Matches', "Blackheart's Bay", 'Score']);
  });

  it("shows an area's fixed sections, and a map opened under one in the breadcrumb", () => {
    const list = resolveShellNav(areas, sections, utilities, null, '/game-info/maps');
    expect(labels(list.level2)).toEqual(['Maps']);
    expect(labels(list.crumbs)).toEqual(['Game Info', 'Maps']);
    const page = resolveShellNav(areas, sections, utilities, map, '/game-info/maps/cursed-hollow');
    expect(labels(page.level2)).toEqual(['Maps']);
    expect(page.level3).toEqual([]);
    expect(page.level3Of).toBeNull();
    expect(labels(page.crumbs)).toEqual(['Game Info', 'Maps', 'Cursed Hollow']);
  });

  it('ignores an item the page shown is not under', () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/replays/matches');
    expect(nav.level3).toEqual([]);
    expect(labels(nav.crumbs)).toEqual(['Replays', 'Matches']);
  });

  it('builds the tree: areas, their sections, the open item where it sits, the current node and its trail', () => {
    const nav = resolveShellNav(areas, sections, utilities, match, '/replays/matches/abc/stats/pvp');
    const [replays, game, about] = nav.tree;
    expect(replays!.active && !replays!.current).toBe(true);
    expect(labels(replays!.children)).toEqual(['Matches', 'Players', 'Maps']);
    expect(replays!.children[2]!.disabled).toBe(true);
    const opened = replays!.children[0]!.children[0]!;
    expect(opened.label).toBe("Blackheart's Bay");
    expect(labels(opened.children)).toEqual(['Score', 'Stats']);
    const pvp = opened.children[1]!.children[0]!;
    expect([pvp.label, pvp.current]).toEqual(['PvP', true]);
    expect(labels(game!.children)).toEqual(['Maps']);
    expect(about!.children).toEqual([]);

    const onMap = resolveShellNav(areas, sections, utilities, map, '/game-info/maps/cursed-hollow').tree[1]!;
    expect(labels(onMap.children[0]!.children)).toEqual(['Cursed Hollow']);
    expect(onMap.children[0]!.children[0]!.current).toBe(true);
  });

  it('lists the utilities in the tree after the areas, starting with a break, and names the one shown', () => {
    const nav = resolveShellNav(areas, sections, utilities, null, '/import');
    expect(nav.tree.map((n) => [n.label, n.breaks ?? false])).toEqual([
      ['Replays', false],
      ['Game Info', false],
      ['About', false],
      ['Import', true],
    ]);
    expect(nav.tree[3]!.current).toBe(true);
    expect(labels(nav.crumbs)).toEqual(['Import']);
  });
});

describe('a hidden area (the settings menu leads to it)', () => {
  const ui: ShellArea = { path: '/ui', label: 'UI', order: 90, hidden: true };
  const uiSections: ShellSection[] = [
    { area: '/ui', label: 'Theme', link: '/ui/theme', order: 10 },
    { area: '/ui', label: 'Components', link: '/ui/components', order: 20, disabled: true },
    {
      area: '/ui',
      label: 'Tests',
      link: '/ui/tests',
      order: 30,
      children: [{ label: 'Lists', link: '/ui/tests/lists' }],
    },
  ];

  it('is not in the top bar, nor the tree, elsewhere', () => {
    const nav = resolveShellNav([...areas, ui], [...sections, ...uiSections], [], null, '/replays');
    expect(nav.areas.map((a) => a.label)).toEqual(['Replays', 'Game Info', 'About']);
    expect(nav.tree.map((n) => n.label)).toEqual(['Replays', 'Game Info', 'About']);
  });

  it('shows its sections, and a section its pages as the side nav, while shown', () => {
    const nav = resolveShellNav([...areas, ui], [...sections, ...uiSections], [], null, '/ui/tests/lists');
    expect(nav.areas.map((a) => a.label)).toEqual(['Replays', 'Game Info', 'About']);
    expect(nav.level2.map((s) => [s.label, s.active])).toEqual([
      ['Theme', false],
      ['Components', false],
      ['Tests', true],
    ]);
    expect(nav.level3Of?.label).toBe('Tests');
    expect(nav.level3.map((s) => [s.label, s.active])).toEqual([['Lists', true]]);
    expect(nav.crumbs.map((c) => c.label)).toEqual(['UI', 'Tests', 'Lists']);
    expect(nav.tree.map((n) => n.label)).toEqual(['Replays', 'Game Info', 'About', 'UI']);
  });
});
