# ShellLayout
The three levels together, desktop: TopBar (level 1), SubBar (level 2), then the page: a SideNav column (level 3) and the content panels, with the optional right Drawer for tools. The Play scene runs behind everything; every surface is a film over it.
- Page content keeps today's layout constraints (constrained / padded / edge-to-edge) inside hrs-layout; the shell adds nothing page-specific.
- Shell panels sit flush against the window: the tool Drawer runs from under the SubBar to the bottom edge on the right, with no gap or margin, and pushes the page's padded content aside on desktop (over it on handset). The nav Drawer does the same on the left on handset.
**Consumer provides:** the routed page; the shell owns bars and drawers. See ShellMobile for the handset form.
