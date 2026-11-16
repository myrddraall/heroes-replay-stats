import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { StyledTextKind } from '@myrddraall/heroes-replay-stats-common/ui';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import {
  CircleFrame,
  Glyph,
  HexFrame,
  Portrait,
  type PortraitSource,
  SquareFrame,
} from '@myrddraall/heroes-replay-stats-heroes/ui';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { SHOWCASE_SIZES } from '../../model';
import { Showcase, ShowcaseItem, ShowcaseRow } from '../../ui';

/** The themes a frame takes: each side's, and the user's own on each side. */
const THEMES = [
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'blue-self', label: 'Self on blue' },
  { id: 'red-self', label: 'Self on red' },
] as const;

/** Each shape's name, as its page is headed. */
const SHAPE_NAMES = { circle: 'Circle', hex: 'Hex', square: 'Square' } as const;

/** A few heroes whose minimap icons go in the frames, by the id a replay records. */
const HEROES = ['Barbarian', 'Jaina'] as const;

/** What one showcase frame holds: a glyph (an icon, a letter) or a portrait, and how it is shown. */
interface Framed {
  readonly kind: 'icon' | 'letter' | 'portrait';
  /** The icon's name or the letter; for a portrait, its name. */
  readonly text: string;
  /** A portrait's pictures, in order of preference (see `PortraitSource`). */
  readonly sources?: readonly PortraitSource[];
  readonly styled?: StyledTextKind | null;
  readonly state?: string | null;
  /** A hex frame's orientation (flat when not given). */
  readonly orientation?: 'flat' | 'pointy';
}

/**
 * A shaped frame's page (`shape`, from the route): the UI area's Components › Frames › Circle frame
 * (`/ui/components/frames/circle`), Hex frame (`/ui/components/frames/hex`) and Square frame
 * (`/ui/components/frames/square`): glyphs (Material
 * icons, capital letters) and hero portraits in the frame, in each theme, state and look, and at a
 * few sizes.
 */
@Component({
  selector: 'hrs-circle-frame-page',
  imports: [CircleFrame, Glyph, HexFrame, Layout, MatIcon, NgTemplateOutlet, Portrait, Showcase, ShowcaseItem, ShowcaseRow, SquareFrame],
  templateUrl: './circle-frame-page.html',
  styleUrl: './circle-frame-page.scss',
})
export class CircleFramePage {
  /** The frame's shape, from the route's data. */
  readonly shape = input<'circle' | 'hex' | 'square'>('circle');
  protected readonly heading = computed(() => `${SHAPE_NAMES[this.shape()]} frame`);
  protected readonly selector = computed(() => `hrs-${this.shape()}-frame`);
  protected readonly themes = THEMES;
  protected readonly sizes = SHOWCASE_SIZES;

  private readonly heroes = inject(LatestHeroData);
  /**
   * The heroes as portraits, once loaded: their square art (the smallest copy that serves the size
   * shown), and in a circle, small, the game's minimap icon first (its art, 26 of 32, filling the
   * inside).
   */
  private readonly portraits = computed((): Framed[] => {
    const lookup = this.heroes.lookup();
    return HEROES.flatMap((id): Framed[] => {
      const art = lookup.heroArt(id);
      const icon = lookup.heroIcon(id);
      const sources: PortraitSource[] = [
        ...(icon && this.shape() === 'circle'
          ? [{ picture: icon.picture, scale: (icon.picture.rect?.[2] ?? 32) / 26 }]
          : []),
        ...(art ? [{ picture: art.picture }] : []),
      ];
      const name = art?.name ?? icon?.name;
      return name && sources.length ? [{ kind: 'portrait', text: name, sources }] : [];
    });
  });

  /** Each theme's row: icons, letters, portraits. */
  protected readonly themed = computed((): Framed[] => [
    ...['person', 'shield', 'bolt', 'settings'].map((text): Framed => ({ kind: 'icon', text })),
    ...['A', 'M', 'W', 'Q'].map((text): Framed => ({ kind: 'letter', text })),
    ...this.portraits(),
  ]);

  /** One of each kind, for the states and sizes. */
  protected readonly samples = computed((): Framed[] => [
    { kind: 'icon', text: 'shield' },
    { kind: 'letter', text: 'M' },
    ...this.portraits().slice(0, 1),
  ]);

  /** The frame's states: none, then each. */
  protected readonly states = [
    { state: null, label: 'plain' },
    { state: 'selected', label: 'selected' },
    { state: 'disabled', label: 'disabled' },
  ] as const;

  /** A glyph's looks. */
  protected readonly looks = [
    { styled: null, label: 'plain' },
    { styled: 'base', label: 'base' },
    { styled: 'bright', label: 'bright' },
    { styled: 'glow', label: 'glow' },
  ] as const;
}
