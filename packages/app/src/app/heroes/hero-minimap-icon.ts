import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { LatestHeroData } from '../data/heroes/hero-data';

/** A hero's minimap icon, by the hero id a replay records (`Barbarian`). */
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
  readonly heroId = input.required<string>();
  private readonly heroData = inject(LatestHeroData);
  private readonly hero = computed(() => {
    const data = this.heroData.data;
    return data.hasValue() ? data.value().hero(this.heroId()) : undefined;
  });
  protected readonly src = computed(() => {
    const hero = this.hero();
    return hero ? this.heroData.images.portrait(hero, 'minimap') : null;
  });
  protected readonly name = computed(() => this.hero()?.name ?? this.heroId());
}
