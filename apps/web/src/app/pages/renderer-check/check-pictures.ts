import { afterRenderEffect, Component, type ElementRef, input, viewChild } from '@angular/core';
import { SLOT_LABELS } from './dual-renderer';
import type { CheckTest } from './renderer-check.store';

/**
 * The renderer check's pictures while a test runs (presentational): the background (projected, the
 * container's), and, where both backends draw, the WebGPU one's canvas beside it (the background
 * then three.js on WebGL 2); each box the same size in every test, so every renderer draws the same
 * pixels. Loading the scene before the tests, the background is up but not shown.
 */
@Component({
  selector: 'hrs-check-pictures',
  templateUrl: './check-pictures.html',
  styleUrl: './check-pictures.scss',
})
export class CheckPictures {
  readonly test = input<CheckTest | null>(null);
  readonly warmingUp = input(false);
  /** The canvas three.js on WebGPU draws into where both draw. */
  readonly webgpuCanvas = input.required<HTMLCanvasElement>();
  protected readonly labels = SLOT_LABELS;
  private readonly webgpuBox = viewChild<ElementRef<HTMLElement>>('webgpu');

  constructor() {
    afterRenderEffect(() => this.webgpuBox()?.nativeElement.append(this.webgpuCanvas()));
  }
}
