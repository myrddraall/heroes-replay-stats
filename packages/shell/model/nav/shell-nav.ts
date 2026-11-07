/** A link in the shell's navigation, with the links under it (a match's Stats and its sections). */
export interface ShellNavLink {
  readonly label: string;
  /** Absolute (`/replays/matches/abc/stats`). */
  readonly link: string;
  /** Something that needs attention, as a count badge. */
  readonly count?: number;
  /** Shown but not open yet (a page still to be built). */
  readonly disabled?: boolean;
  readonly children?: readonly ShellNavLink[];
}

/** A level-1 area of the site (`/replays`), added by the domain whose pages it holds (or the app). */
export interface ShellArea {
  readonly path: string;
  readonly label: string;
  /** Areas show in ascending order. */
  readonly order: number;
  /**
   * Reached from elsewhere (the settings menu's Dev group): not in the top bar, and in the tree
   * only while its pages are shown. Its sections and their pages work as any area's.
   */
  readonly hidden?: boolean;
}

/** A fixed level-2 section of an area (Replays' Matches), added by the domain whose page it opens. */
export interface ShellSection {
  /** The area's path. */
  readonly area: string;
  readonly label: string;
  readonly link: string;
  readonly order: number;
  /** Shown but not open yet (a page still to be built). */
  readonly disabled?: boolean;
  /** Its pages, as the page's side nav lists them while the section is shown. */
  readonly children?: readonly ShellNavLink[];
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
 * breadcrumb and a node of the tree, with its own sections when it has them (the page's side nav
 * while it is open, their children its sub-items).
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
  /** The page shown is this one, or under it (never, while disabled). */
  readonly active: boolean;
  /** Shown but not open yet. */
  readonly disabled?: boolean;
}

/** A level-3 entry (the page's side nav), with its sub-items. */
export interface ShellSideEntry extends ShellNavEntry {
  readonly children: readonly ShellNavEntry[];
}

/** A node of the navigation tree: every level at once (the handset's nav drawer). */
export interface ShellNavNode extends ShellNavEntry {
  /** The page shown is this one exactly. */
  readonly current: boolean;
  /** It starts the utilities' pages, after the areas. */
  readonly breaks?: boolean;
  readonly children: readonly ShellNavNode[];
}

/** The navigation for the page shown. */
export interface ShellNav {
  /** Level 1, in order. */
  readonly areas: readonly ShellNavEntry[];
  /** The area's sections. */
  readonly level2: readonly ShellNavEntry[];
  /** The open item's sections (a match's), or else the level-2 section's children. */
  readonly level3: readonly ShellSideEntry[];
  /** What level 3 belongs to (the open item, or the level-2 section). */
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
    active: !link.disabled && isUnder(url, link.link),
    ...(link.count === undefined ? {} : { count: link.count }),
    ...(link.disabled ? { disabled: true } : {}),
  };
}

function node(link: ShellNavLink, url: string, extra: readonly ShellNavLink[] = []): ShellNavNode {
  const children = [...(link.children ?? []), ...extra].map((c) => node(c, url));
  const shown = entry(link, url);
  return { ...shown, current: shown.active && !children.some((c) => c.active), children };
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
  const ordered = [...areas].sort(byOrder);
  // a hidden area shows only while its pages are
  const shown = ordered.filter((a) => !a.hidden || isUnder(path, a.path));
  const sectionsOf = (area: ShellArea): ShellNavLink[] =>
    sections
      .filter((s) => s.area === area.path)
      .sort(byOrder)
      .map(({ label, link, disabled, children }) => ({
        label,
        link,
        ...(disabled ? { disabled } : {}),
        ...(children?.length ? { children } : {}),
      }));
  const itemLink: ShellNavLink | null = item
    ? { label: item.label, link: item.link, children: item.sections ?? [] }
    : null;

  const tree: ShellNavNode[] = shown.map((area) => {
    const own = sectionsOf(area).map((s) =>
      itemLink && item!.under === s.link ? { ...s, children: [...(s.children ?? []), itemLink] } : s,
    );
    const underArea = itemLink && item!.under === area.path ? [itemLink] : [];
    return node({ label: area.label, link: area.path, children: own }, path, underArea);
  });
  const usable = [...utilities].sort(byOrder).map(({ label, link }) => ({ label, link }));
  tree.push(...usable.map((u, i) => ({ ...node(u, path), breaks: i === 0 && tree.length > 0 })));

  const area = ordered.find((a) => isUnder(path, a.path)) ?? null;
  const open = item && isUnder(path, item.link) ? item : null;
  const areaSections = area ? sectionsOf(area) : [];
  const areaSection = areaSections.find((s) => !s.disabled && isUnder(path, s.link)) ?? null;
  // level 3: what is open has its sections there; otherwise the section shown has its children
  const side = open ? (open.sections ?? []) : (areaSection?.children ?? []);
  const level3Of = side.length ? (open ?? areaSection) : null;
  const two = side.find((s) => !s.disabled && isUnder(path, s.link)) ?? null;
  const three = two?.children?.find((s) => !s.disabled && isUnder(path, s.link)) ?? null;

  // a page outside the areas that a utility leads to: itself
  const utility = area ? null : (usable.find((u) => isUnder(path, u.link)) ?? null);
  const crumbs = [
    area && { label: area.label, link: area.path },
    utility,
    areaSection,
    open && { label: open.label, link: open.link },
    two,
    three,
  ]
    .filter((c): c is ShellNavLink => c !== null)
    .map((c) => entry(c, path));

  return {
    areas: ordered.filter((a) => !a.hidden).map((a) => entry({ label: a.label, link: a.path }, path)),
    level2: areaSections.map((s) => entry(s, path)),
    level3: side.map((s) => ({ ...entry(s, path), children: (s.children ?? []).map((c) => entry(c, path)) })),
    level3Of: level3Of && entry({ label: level3Of.label, link: level3Of.link }, path),
    crumbs,
    tree,
  };
}
