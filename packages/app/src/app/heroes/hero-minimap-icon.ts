import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';

/** A hero's minimap icon (`src`), named for the hero; nothing without a picture. */
@Component({
  selector: 'hrs-hero-minimap-icon',
  imports: [NgOptimizedImage],
  template: `@if (src(); as src) {
    <img [ngSrc]="src" width="32" height="32" [alt]="name()" />
  }`,
  styles: `
    :host {
      display: inline-block;
      width: 32px;
      height: 32px;
      flex: none;
    }
    img {
      display: block;
    }
  `,
})
export class HeroMinimapIcon {
  readonly src = input<string | null>(null);
  readonly name = input.required<string>();
}
