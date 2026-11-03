/** A link in the shell's navigation, with the links under it (a match's Stats and its sections). */
export interface ShellNavLink {
  readonly label: string;
  /** Absolute (`/matches/abc/stats`). */
  readonly link: string;
  /** Something that needs attention, as a count badge. */
  readonly count?: number;
  readonly children?: readonly ShellNavLink[];
}

/**
 * The families of areas on the top bar, in order, the game's separator between them: what the
 * replays tell (matches and what adds up across them), then the game in general.
 */
export const SHELL_AREA_FAMILIES = ['matches', 'game'] as const;
export type ShellAreaFamily = (typeof SHELL_AREA_FAMILIES)[number];

/** A level-1 area of the site (`/matches`), added by the domain whose pages it holds. */
export interface ShellArea {
  readonly path: string;
  readonly label: string;
  readonly family: ShellAreaFamily;
  /** Areas show in ascending order within their family. */
  readonly order: number;
}

/** A fixed level-2 section of an area (Game's Maps), added by the domain whose page it opens. */
export interface ShellSection {
  /** The area's path. */
  readonly area: string;
  readonly label: string;
  readonly link: string;
  readonly order: number;
}

/**
 * A page the top bar's utility cluster leads to (Import, through its pod), listed in the tree after
 * the areas where the cluster is not (a handset).
 */
export interface ShellUtilityLink {
  readonly label: string;
  readonly link: string;
  readonly order: number;
}

/** An entry of the settings menu (Settings, About, and the Dev pages). */
export interface ShellMenuItem {
  readonly label: string;
  readonly link: string;
  /** A part of the page to show (`about`). */
  readonly fragment?: string;
  /** Entries show in ascending order, the Dev group after the rest. */
  readonly order: number;
  readonly group?: 'dev';
}

/**
 * What a page has open (a match, a map), under an area or one of its sections: a step in the
 * breadcrumb and a node of the tree, with its own sections when it has them (level 2 while it is
 * open, their children level 3).
 */
export interface ShellItem {
  /** The area's path or a section's link it sits under. */
  readonly under: string;
  readonly label: string;
  readonly link: string;
  readonly sections?: readonly ShellNavLink[];
}

/** A link as shown: whether it is the page shown, or on the way to it. */
export interface ShellNavEntry {
  readonly label: string;
  readonly link: string;
  readonly count?: number;
  /** The page shown is this one, or under it. */
  readonly active: boolean;
}

/** A node of the navigation tree: every level at once (the handset's nav drawer). */
export interface ShellNavNode extends ShellNavEntry {
  /** The page shown is this one exactly. */
  readonly current: boolean;
  /** It starts another family (the game's, or the utilities after the areas). */
  readonly breaks?: boolean;
  readonly children: readonly ShellNavNode[];
}

/** The navigation for the page shown. */
export interface ShellNav {
  /** Level 1, in order, with the family each starts (the first of a family after the first). */
  readonly areas: readonly (ShellNavEntry & { readonly family: ShellAreaFamily; readonly breaks: boolean })[];
  readonly level2: readonly ShellNavEntry[];
  readonly level3: readonly ShellNavEntry[];
  /** The level-2 entry level 3 belongs to. */
  readonly level3Of: ShellNavEntry | null;
  readonly crumbs: readonly ShellNavEntry[];
  readonly tree: readonly ShellNavNode[];
}

/** Whether `url` (a path, no query) is `link` or under it. */
export function isUnder(url: string, link: string): boolean {
  return url === link || url.startsWith(link.endsWith('/') ? link : `${link}/`);
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

function entry(link: ShellNavLink, url: string): ShellNavEntry {
  return {
    label: link.label,
    link: link.link,
    active: isUnder(url, link.link),
    ...(link.count === undefined ? {} : { count: link.count }),
  };
}

function node(link: ShellNavLink, url: string, extra: readonly ShellNavLink[] = []): ShellNavNode {
  const children = [...(link.children ?? []), ...extra].map((c) => node(c, url));
  const active = isUnder(url, link.link);
  return { ...entry(link, url), current: active && !children.some((c) => c.active), children };
}

/**
 * The navigation for `url`: the areas, their sections and what the page has open (`item`), as
 * the top bar, the sub-bar, the page's side nav, the breadcrumb and the tree show them.
 */
export function resolveShellNav(
  areas: readonly ShellArea[],
  sections: readonly ShellSection[],
  utilities: readonly ShellUtilityLink[],
  item: ShellItem | null,
  url: string,
): ShellNav {
  const path = url.split(/[?#]/)[0] ?? url;
  const ordered = SHELL_AREA_FAMILIES.flatMap((family) =>
    areas.filter((a) => a.family === family).sort(byOrder),
  );
  const sectionsOf = (area: ShellArea): ShellNavLink[] =>
    sections
      .filter((s) => s.area === area.path)
      .sort(byOrder)
      .map(({ label, link }) => ({ label, link }));
  const itemLink: ShellNavLink | null = item
    ? { label: item.label, link: item.link, children: item.sections ?? [] }
    : null;

  const tree: ShellNavNode[] = ordered.map((area, i) => {
    const own = sectionsOf(area).map((s) =>
      itemLink && item!.under === s.link ? { ...s, children: [...(s.children ?? []), itemLink] } : s,
    );
    const underArea = itemLink && item!.under === area.path ? [itemLink] : [];
    const breaks = i > 0 && area.family !== ordered[i - 1]!.family;
    return { ...node({ label: area.label, link: area.path, children: own }, path, underArea), breaks };
  });
  const usable = [...utilities].sort(byOrder).map(({ label, link }) => ({ label, link }));
  tree.push(...usable.map((u, i) => ({ ...node(u, path), breaks: i === 0 && tree.length > 0 })));

  const area = ordered.find((a) => isUnder(path, a.path)) ?? null;
  const open = item && isUnder(path, item.link) ? item : null;
  const areaSections = area ? sectionsOf(area) : [];
  const levelTwo = open?.sections?.length ? open.sections : areaSections;
  const level2 = levelTwo.map((s) => entry(s, path));
  const two = levelTwo.find((s) => isUnder(path, s.link)) ?? null;
  const level3 = (two?.children ?? []).map((s) => entry(s, path));
  const three = two?.children?.find((s) => isUnder(path, s.link)) ?? null;
  const areaSection = areaSections.find((s) => isUnder(path, s.link)) ?? null;

  // a page outside the areas that a utility leads to: itself
  const utility = area ? null : (usable.find((u) => isUnder(path, u.link)) ?? null);
  const crumbs = [
    area && { label: area.label, link: area.path },
    utility,
    areaSection,
    open && { label: open.label, link: open.link },
    open?.sections?.length ? two : null,
    three,
  ]
    .filter((c): c is ShellNavLink => c !== null)
    .map((c) => entry(c, path));

  let family: ShellAreaFamily | null = null;
  return {
    areas: ordered.map((a, i) => {
      const breaks = i > 0 && a.family !== family;
      family = a.family;
      return { label: a.label, link: a.path, family: a.family, breaks, active: isUnder(path, a.path) };
    }),
    level2,
    level3,
    level3Of: level3.length && two ? entry(two, path) : null,
    crumbs,
    tree,
  };
}
