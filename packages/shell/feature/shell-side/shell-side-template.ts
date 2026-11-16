import { DestroyRef, Directive, inject, input, type OnInit, TemplateRef } from '@angular/core';
import { ShellPanelsStore, type ShellSideSlot } from '../../data';

/**
 * A page's own content for the shell's left-hand drawer, over or under its sections, shown there
 * while the page (or the part of it that declares it) is: `<ng-template hrsShellSide="header">`.
 */
@Directive({ selector: 'ng-template[hrsShellSide]' })
export class ShellSideTemplate implements OnInit {
  /** Over the sections (`header`) or under them (`footer`). */
  readonly hrsShellSide = input.required<ShellSideSlot>();

  private readonly panels = inject(ShellPanelsStore);
  private readonly template = inject(TemplateRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const slot = this.hrsShellSide();
    this.panels.showSide(slot, this.template);
    this.destroyRef.onDestroy(() => this.panels.clearSide(slot, this.template));
  }
}
