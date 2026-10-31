import { afterRenderEffect, Component, type ElementRef, input, viewChild } from '@angular/core';

/** The difference between the WebGPU and WebGL 2 pictures, as compared (presentational). */
@Component({
  selector: 'hrs-check-difference',
  templateUrl: './check-difference.html',
  styleUrl: './check-difference.scss',
})
export class CheckDifference {
  readonly difference = input.required<{ image: ImageData; width: number; height: number }>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterRenderEffect(() => {
      const { image, width, height } = this.difference();
      const canvas = this.canvas().nativeElement;
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.putImageData(image, 0, 0);
    });
  }
}
