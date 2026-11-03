import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  signal,
  type Type,
  viewChild,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatTabNavPanel } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  type ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  ResolveEnd,
  Router,
  RouterLink,
  RouterOutlet,
  type RouterStateSnapshot,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { injectNavigationTextures, ShellNavStore, ShellPanelsStore } from '../../data';
import {
  Crumbs,
  NavTree,
  SHELL_BACKDROP,
  SHELL_FILE_DROPS,
  SHELL_LOOK,
  SHELL_TOOLBAR_ACTIONS,
  SubBar,
  TopBar,
} from '../../ui';
import { SHELL_MENU_ITEMS } from '../../model';
import { filmStyle } from './films';

/** Whether a drag carries files (as opposed to text or links dragged within the page). */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/** Whether a route on the way to the page asks for it to be shown without the shell (`data: { shell: false }`). */
function bareRoute(state: RouterStateSnapshot): boolean {
  for (let route: ActivatedRouteSnapshot | null = state.root; route; route = route.firstChild) {
    if (route.data['shell'] === false) return true;
  }
  return false;
}

/** The page's own title (`Settings` of `Settings · Heroes Replay Stats`): the deepest route's. */
function pageTitle(state: RouterStateSnapshot): string | null {
  let title: string | undefined;
  for (let route: ActivatedRouteSnapshot | null = state.root; route; route = route.firstChild)
    title = route.title ?? title;
  return title?.split(' · ')[0] ?? null;
}

/**
 * The frame round every page (the theme's ShellLayout): behind everything the backdrop (one for
 * every page, so it keeps running as they change); over it the top bar (the areas, the utility
 * cluster other domains fill, the settings menu) and the sub-bar (the sections of what is shown),
 * then the routed page, with the tool drawer on the right that the page fills (`hrsShellPanel`).
 * The page's own sections are its side nav (`hrs-shell-side-nav`, in its layout). On a handset
 * (`hrs-shell--handset`) the bars give way to a title and a breadcrumb, and every level is one tree
 * in a nav drawer from the left. The shell wears the theme the user chose, and the textures its bars
 * are drawn with. A page whose route says `data: { shell: false }` fills the window on its own: the
 * outlet stays where it is, the frame round it goes.
 */
@Component({
  selector: 'hrs-shell',
  imports: [
    Crumbs,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatTabNavPanel,
    MatTooltipModule,
    NavTree,
    NgComponentOutlet,
    NgTemplateOutlet,
    RouterLink,
    RouterOutlet,
    SubBar,
    TopBar,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  providers: [ShellNavStore, ShellPanelsStore],
  host: {
    '[attr.data-theme]': 'look.theme()',
    '[style]': 'style()',
    '[class.hrs-shell--handset]': 'handset()',
    '(document:dragenter)': 'onDragEnter($event)',
    '(document:dragover)': 'onDragOver($event)',
    '(document:dragleave)': 'onDragLeave($event)',
    '(document:drop)': 'onDrop($event)',
  },
})
export class Shell {
  /** The theme and the films. */
  protected readonly look = inject(SHELL_LOOK);
  private readonly films = computed(() => filmStyle(this.look.opacity(), this.look.blur()));
  /** The game textures the bars draw with, once loaded. */
  private readonly textures = injectNavigationTextures();
  protected readonly style = computed(() => ({ ...this.films(), ...this.textures() }));
  /** The backdrop's component, once loaded. */
  protected readonly backdropComponent = signal<Type<unknown> | null>(null);
  /** Whether the page shows without the frame. */
  protected readonly bare = signal(false);
  /** True while files are being dragged over the page; shows the drop overlay. */
  protected readonly dragging = signal(false);
  /** dragenter/dragleave fire for every element crossed, so track nesting depth. */
  private dragDepth = 0;
  private readonly drops = inject(SHELL_FILE_DROPS);
  /** What the drop overlay says: the first taker's. */
  protected readonly drop = this.drops[0] ?? null;

  /** The navigation for the page shown. */
  protected readonly navStore = inject(ShellNavStore);
  protected readonly nav = this.navStore.nav;
  /** The page's own title, for a page outside the areas (Settings, Import). */
  private readonly routeTitle = signal<string | null>(null);
  /** What the handset's top bar names: the current area, or the page. */
  protected readonly title = computed(
    () => this.nav().areas.find((a) => a.active)?.label ?? this.routeTitle(),
  );
  /** The settings menu: its own entries, then the Dev pages. */
  private readonly menuItems = [...inject(SHELL_MENU_ITEMS)].sort((a, b) => a.order - b.order);
  protected readonly menu = this.menuItems.filter((i) => i.group !== 'dev');
  protected readonly devMenu = this.menuItems.filter((i) => i.group === 'dev');
  /** The extra panel on the right, which the page fills. */
  protected readonly panels = inject(ShellPanelsStore);
  protected readonly toolbarActions = inject(SHELL_TOOLBAR_ACTIONS);
  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  private readonly navDrawer = viewChild<MatSidenav>('navDrawer');
  /** Whether the handset's nav drawer is open. */
  protected readonly navOpen = signal(false);

  /** Whether files dragged over the page are taken here (a page shown without the frame takes its own). */
  private takesFiles(event: DragEvent): boolean {
    return this.drops.length > 0 && !this.bare() && hasFiles(event);
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.takesFiles(event)) return;
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.takesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(event: DragEvent): void {
    if (!this.takesFiles(event)) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!this.takesFiles(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    for (const drop of this.drops) {
      const taken = files.filter((f) => drop.accepts(f));
      if (taken.length > 0) drop.drop(taken);
    }
  }

  constructor() {
    // What opens over the page (menus, selects, dialogs) wears the same theme and films.
    const overlay = inject(OverlayContainer).getContainerElement();
    effect(() => {
      overlay.setAttribute('data-theme', this.look.theme());
      for (const [property, value] of Object.entries(this.films()))
        overlay.style.setProperty(property, value);
    });
    const router = inject(Router);
    router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      // Before the page is shown, so it never shows in the wrong frame.
      if (e instanceof ResolveEnd) this.bare.set(bareRoute(e.state));
      else if (e instanceof NavigationCancel || e instanceof NavigationError)
        this.bare.set(bareRoute(router.routerState.snapshot));
    });
    router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.navStore.at(e.urlAfterRedirects);
        this.routeTitle.set(pageTitle(router.routerState.snapshot));
        // The nav drawer covers the page: any link followed in it (or anywhere) closes it.
        void this.navDrawer()?.close();
      });
    // The backdrop's chunk, fetched once the page is up: it fades in when its scene has loaded anyway.
    const load = inject(SHELL_BACKDROP);
    if (load) {
      afterNextRender(() => {
        const idle = window.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 1));
        idle(() => void load().then((component) => this.backdropComponent.set(component)));
      });
    }
  }

  protected toggleNav(): void {
    void this.navDrawer()?.toggle();
  }
}
