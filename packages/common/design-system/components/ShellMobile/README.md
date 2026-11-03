# ShellMobile
The handset form of the shell (`hrs-shell--handset`, set by the shell's breakpoint signal, never a media query). No horizontal navs:
- **TopBar**: the menu IconButton, the current area's title in the selected nav look (white gradient, the game's underline on the bar edge), and settings. The bar keeps its textures and shimmer.
- **Breadcrumb** (`.hrs-crumbs`) in the SubBar band: area › page › section, ellipsing the middle crumbs first; the last one in the selected look. Crumbs are links back up the tree.
- **Navigation** is one NavTree in the nav Drawer (`.hrs-drawer--nav`, from the left, over the page): every area, its pages and their sections, the branch holding the current page open and lit. This replaces the SubBar tabs and the SideNav column, so level 3 needs no select on handset.
- The tool Drawer (column picker) still opens from the right, over the content.
Left: the page with the drawer closed. Right: the drawer open.
