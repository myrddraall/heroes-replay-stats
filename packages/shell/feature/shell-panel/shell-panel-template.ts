import { DestroyRef, Directive, inject, input, type OnInit, TemplateRef } from '@angular/core';
import { ShellPanelsStore } from '../../data';

/**
 * A page's tools for the shell's right-hand panel, shown there while the page (or the part of it
 * that declares them) is: `<ng-template hrsShellPanel="Columns">…</ng-template>`.
 */
@Directive({ selector: 'ng-template[hrsShellPanel]' })
export class ShellPanelTemplate implements OnInit {
  /** What the panel is, for screen readers and the toolbar's toggle. */
  readonly hrsShellPanel = input.required<string>();

  private readonly panels = inject(ShellPanelsStore);
  private readonly template = inject(TemplateRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const content = { label: this.hrsShellPanel(), template: this.template };
    this.panels.show(content);
    this.destroyRef.onDestroy(() => this.panels.clear(content));
  }
}
