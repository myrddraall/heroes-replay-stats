# NavTree
Every navigation level as one tree, in the game's nav type: areas in `nav-1`-weight uppercase, pages and sections in the sub-nav style, all in the TaskBarNavigation gradients of the theme. Children indent under a hairline guide.
- The current item (`aria-current="page"`) takes the selected label look (white gradient) on a selection-fill row, with the game's underline texture turned upright on the tree's guide line beside it, its glow fanning into the row. Each branch on the way to it (`is-trail`) is lit and open (`aria-expanded="true"`); other branches start closed.
- Counts (`hrs-badge--count`) sit at the end of an area row.
- Disabled items (pages still to be built) show dim and are not links. Every area row has its chevron, sections or not; other rows without children have none.
- Used as the handset navigation in the nav Drawer; can also serve as a desktop side panel where a page has deep structure.
**Consumer provides:** the route tree, the current route, counts. **Angular:** `cdk-tree` / `mat-tree` with nested nodes rendered as `.hrs-tree__item` links; `aria-expanded` from the node state.
