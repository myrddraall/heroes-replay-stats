import { DestroyRef, Directive, inject, input, type OnInit, TemplateRef } from '@angular/core';
import { ShellNavStore } from '../../data';

/**
 * A page's navigation, shown under one of the shell's main nav items while the page (or the part
 * of it that declares it) is: `<ng-template hrsShellNavChildren="/replays">…</ng-template>`.
 */
@Directive({ selector: 'ng-template[hrsShellNavChildren]' })
export class ShellNavChildren implements OnInit {
  /** The path of the nav item to show it under. */
  readonly hrsShellNavChildren = input.required<string>();

  private readonly nav = inject(ShellNavStore);
  private readonly template = inject(TemplateRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const path = this.hrsShellNavChildren();
    this.nav.show(path, this.template);
    this.destroyRef.onDestroy(() => this.nav.clear(path, this.template));
  }
}
