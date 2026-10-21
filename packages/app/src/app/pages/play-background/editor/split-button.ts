import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { GraphicsStore } from '../../../data/settings/graphics.store';
import { PickFlyout, type PickItem } from './pick-flyout';

/**
 * One thing a split button does: its name and icon, whether it can be done now, and, where it
 * picks one of many (an existing part, a planet), what it picks from (a flyout of them).
 */
export interface SplitOption {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly disabled?: boolean;
  readonly pick?: {
    readonly title: string;
    readonly icon: string;
    readonly items: readonly PickItem[];
  };
}

/**
 * A button that does one of several things (presentational), as the map's state control is: a
 * click does the one it shows (the first, then the one done last); its arrow opens a menu of them
 * all (no arrow where there is only one). One that picks opens a flyout of what it picks from,
 * under the button. What is done is given by its id (`chosen`), or with what was picked (`picked`).
 */
@Component({
  selector: 'hrs-split-button',
  imports: [
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    CdkOverlayOrigin,
    CdkConnectedOverlay,
    PickFlyout,
  ],
  templateUrl: './split-button.html',
  styleUrl: './split-button.scss',
})
export class SplitButton {
  readonly options = input.required<readonly SplitOption[]>();
  /** What the arrow is called (for its label). */
  readonly menuLabel = input('More');
  readonly chosen = output<string>();
  readonly picked = output<{ readonly option: string; readonly item: string }>();
  protected readonly graphics = inject(GraphicsStore);
  /** The one done last (none yet: the first that can be done). */
  private readonly last = signal<string | null>(null);
  /** The one picking now (its flyout open), by id. */
  private readonly pickingId = signal<string | null>(null);
  protected readonly main = computed(() => {
    const options = this.options();
    return (
      options.find((o) => o.id === this.last() && !o.disabled) ??
      options.find((o) => !o.disabled) ??
      options[0]
    );
  });
  protected readonly picking = computed(
    () => this.options().find((o) => o.id === this.pickingId() && o.pick) ?? null,
  );
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];

  protected choose(option: SplitOption): void {
    if (option.disabled) return;
    this.last.set(option.id);
    if (option.pick) this.pickingId.set(option.id);
    else this.chosen.emit(option.id);
  }

  protected pick(item: string): void {
    const option = this.pickingId();
    this.pickingId.set(null);
    if (option) this.picked.emit({ option, item });
  }

  protected close(): void {
    this.pickingId.set(null);
  }
}
