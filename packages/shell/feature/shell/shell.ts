import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  afterNextRender,
  Component,
  computed,
  inject,
  signal,
  type Type,
  viewChild,
} from '@angular/core';
import { NgComponentOutlet, NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  type ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  ResolveEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  type RouterStateSnapshot,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { injectPlatform } from '@myrddraall/heroes-replay-stats-platform/data';
import { ShellNavStore, ShellPanelsStore } from '../../data';
import {
  SHELL_BACKDROP,
  SHELL_FILE_DROPS,
  SHELL_LOOK,
  SHELL_NAV_ITEMS,
  SHELL_TOOLBAR_ACTIONS,
} from '../../ui';

/** How much the glass blurs what is behind it, when it does. */
const GLASS_BLUR = 'blur(6px)';

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

/**
 * The frame round every page: behind everything the backdrop (one for every page, so it keeps
 * running as they change), and over it in glass a toolbar, a rail/sidenav that collapses on small
 * screens (a page can put its own navigation under its parent's item, `hrsShellNavChildren`), the
 * routed page, and on the right an extra panel the page can fill with its tools (`hrsShellPanel`).
 * What it shows of other domains comes through its slots (`shell-slots.ts`). A page whose route says
 * `data: { shell: false }` fills the window on its own: the outlet stays where it is, the frame round
 * it goes.
 */
@Component({
  selector: 'hrs-shell',
  imports: [
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    NgComponentOutlet,
    NgOptimizedImage,
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  providers: [ShellNavStore, ShellPanelsStore],
  host: {
    '[class]': "'hrs-glass-' + look.theme()",
    '[style.--hrs-glass-alpha]': 'look.glassAlpha()',
    '[style.--hrs-glass-alpha-frame]': 'look.frameAlpha()',
    '[style.--hrs-glass-backdrop]': 'backdrop()',
    '[style.--hrs-glass-backdrop-frame]': 'backdrop()',
    '(document:dragenter)': 'onDragEnter($event)',
    '(document:dragover)': 'onDragOver($event)',
    '(document:dragleave)': 'onDragLeave($event)',
    '(document:drop)': 'onDrop($event)',
  },
})
export class Shell {
  /** The theme and the glass. */
  protected readonly look = inject(SHELL_LOOK);
  protected readonly backdrop = computed(() => (this.look.blur() ? GLASS_BLUR : 'none'));
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
  /** What the open page puts under its parent's nav item. */
  protected readonly subnav = inject(ShellNavStore);
  /** The extra panel on the right, which the page fills. */
  protected readonly panels = inject(ShellPanelsStore);
  protected readonly platform = injectPlatform();
  protected readonly items = [...inject(SHELL_NAV_ITEMS)].sort((a, b) => a.order - b.order);
  protected readonly toolbarActions = inject(SHELL_TOOLBAR_ACTIONS);
  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  private readonly nav = viewChild<MatSidenav>('nav');

  constructor() {
    const router = inject(Router);
    router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      // Before the page is shown, so it never shows in the wrong frame.
      if (e instanceof ResolveEnd) this.bare.set(bareRoute(e.state));
      else if (e instanceof NavigationCancel || e instanceof NavigationError)
        this.bare.set(bareRoute(router.routerState.snapshot));
    });
    // On a handset the menu covers the page: any link followed in it (a page's own navigation too)
    // closes it.
    router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.handset()) void this.nav()?.close();
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
    void this.nav()?.toggle();
  }
}
