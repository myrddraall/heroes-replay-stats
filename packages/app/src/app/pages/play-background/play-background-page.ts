import { DOCUMENT, Location } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, resource, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { GraphicsStore } from '../../data/settings/graphics.store';
import { BackgroundStore } from '../../scenes/play-background/background.store';
import { PLAY_SCENE_URL } from '../../scenes/play-background/play-scene';
import { PlayBackground } from '../../scenes/play-background/play-background';
import { MapPanel } from '../maps/panel/map-panel';
import {
  DEFAULT_SHADE,
  DEFAULT_STRENGTHS,
  loadPlanetFile,
  loadPlanetIndex,
} from '../../scenes/play-background/scene-planets';
import { TintControls } from './tint-controls';
import {
  backgroundTints,
  PRESETS,
  type TintPreset,
  type TintSettings,
  UNTINTED,
} from './tint-settings';

/**
 * The Play screen background on its own, filling the window: nothing else on the page but a back
 * button in the top left and a side panel of controls, as the map explorer has, opened and closed
 * from the top right.
 * The page holds the background's tints while it is open, over the site's colour; leaving it
 * gives the site's back. Its controls are in the Graphics settings' theme. A Review choice brings
 * in one planet on its own, centred, in place of the sets, while the page is open, with its own
 * settings (glow, light, shade, haze, its style's): each planet keeps its own in each style it is
 * shown in (a variant of it), over what its file and the style give it, and Reset gives those
 * back for the variant shown. The planets' names float over them here unless
 * switched off. The page's choices (review, names, tints, each planet's settings) are kept
 * across visits.
 */
/** Where a planet is put to review it: in the middle of the view, filling much of it. */
const REVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const REVIEW_RADIUS = 18;
/** Where the page's choices are kept. */
const STORAGE_KEY = 'hrs.background-page';

/**
 * A planet's settings on this page, each where it was set here (else the planet's own apply): in
 * each style it is shown in (a variant of the planet), its own.
 */
interface VariantChoices {
  readonly glow?: number;
  readonly lighting?: number;
  readonly shade?: number;
  readonly haze?: number;
  /** Its style's parts: how strongly they show, and the shield's own glow. */
  readonly shield?: number;
  readonly ring?: number;
  readonly shieldGlow?: number;
  readonly shieldSpread?: number;
  readonly shieldScale?: number;
  readonly shieldCut?: number;
}

interface PlanetChoices {
  /** The style it is shown in, where chosen here. */
  readonly style?: string;
  /** Its settings in each style, by the style's id ('' for none). */
  readonly variants?: Readonly<Record<string, VariantChoices>>;
}

/** A planet's settings as shown: its own, over its style's, over its file's tuning, over the defaults. */
interface PlanetValues {
  readonly style: string;
  readonly glow: number;
  readonly lighting: number;
  readonly shade: number;
  readonly haze: number;
  readonly shield: number;
  readonly ring: number;
  readonly shieldGlow: number;
  readonly shieldSpread: number;
  readonly shieldScale: number;
  readonly shieldCut: number;
}

interface PageChoices {
  readonly review: string;
  readonly names: boolean;
  readonly panel: boolean;
  readonly settings: TintSettings;
  readonly planets: Readonly<Record<string, PlanetChoices>>;
}

function storedChoices(): Partial<PageChoices> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Partial<PageChoices>) : {};
  } catch {
    return {};
  }
}

@Component({
  selector: 'hrs-play-background-page',
  imports: [
    PlayBackground,
    TintControls,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatSlider,
    MatSliderThumb,
    MatDrawerContainer,
    MatDrawer,
    MatDrawerContent,
    MapPanel,
  ],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  private readonly root = inject(DOCUMENT).documentElement;
  protected readonly presets = PRESETS;
  private readonly stored = storedChoices();
  protected readonly settings = signal<TintSettings>(this.stored.settings ?? UNTINTED);
  /** Whether the panel of controls is open. */
  protected readonly panel = signal(this.stored.panel ?? true);
  private readonly background = inject(BackgroundStore);
  protected readonly graphics = inject(GraphicsStore);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** The planets there are to review. */
  protected readonly planets = resource({
    loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal),
  });
  /** The planet under review, by id; none: the sets. */
  protected readonly review = signal(this.stored.review ?? '');
  /** Whether the planets' names float over them: they do here unless switched off. */
  protected readonly names = signal(this.stored.names ?? true);
  /** Each planet's settings set on this page, by id. */
  private readonly choices = signal<Readonly<Record<string, PlanetChoices>>>(
    this.stored.planets ?? {},
  );
  /** The reviewed planet's choices here. */
  private readonly planetChoices = computed(() => this.choices()[this.review()] ?? {});
  /** The reviewed planet's file: what it has, for which controls apply, and its own tuning. */
  private readonly reviewed = resource({
    params: () => this.review() || undefined,
    loader: ({ params, abortSignal }) => loadPlanetFile(PLAY_SCENE_URL, params, abortSignal),
  });
  private readonly file = computed(() =>
    this.reviewed.hasValue() ? this.reviewed.value() : null,
  );
  /** The style the reviewed planet wears, by id; none: as it is. */
  protected readonly style = computed(
    () => this.planetChoices().style ?? this.file()?.tuning?.style ?? '',
  );
  /** The reviewed planet's settings set here, in the style it is shown in. */
  private readonly chosen = computed(
    (): VariantChoices => this.planetChoices().variants?.[this.style()] ?? {},
  );
  /** The style's file, for what it brings (its shade). */
  private readonly styled = resource({
    params: () => this.style() || undefined,
    loader: ({ params, abortSignal }) =>
      loadPlanetFile(PLAY_SCENE_URL, `style-${params}`, abortSignal),
  });
  /** The reviewed planet's settings as shown. */
  protected readonly values = computed((): PlanetValues => {
    const chosen = this.chosen();
    const tuning = this.file()?.tuning;
    const style = this.styled.hasValue() ? this.styled.value() : undefined;
    return {
      style: this.style(),
      glow: chosen.glow ?? tuning?.glow ?? 1,
      lighting: chosen.lighting ?? tuning?.lighting ?? 1,
      // A style it wears shades it its way; else its own tuning.
      shade:
        chosen.shade ??
        style?.shade?.strength ??
        tuning?.shade?.strength ??
        DEFAULT_SHADE.strength,
      haze: chosen.haze ?? tuning?.strengths?.layer ?? DEFAULT_STRENGTHS.layer ?? 1,
      shield: chosen.shield ?? style?.tuning?.strengths?.shield ?? 1,
      ring: chosen.ring ?? style?.tuning?.strengths?.ring ?? 1,
      shieldGlow: chosen.shieldGlow ?? style?.tuning?.glows?.shield ?? 1,
      shieldSpread: chosen.shieldSpread ?? style?.tuning?.spreads?.shield ?? 0,
      shieldScale: chosen.shieldScale ?? style?.tuning?.scales?.shield ?? 1,
      shieldCut: chosen.shieldCut ?? style?.tuning?.cuts?.shield ?? 0,
    };
  });
  /** Whether the reviewed planet has anything set here to reset. */
  protected readonly changed = computed(() => Object.keys(this.chosen()).length > 0);
  /** Whether the reviewed planet has emissive layers to glow. */
  protected readonly canGlow = computed(() => {
    const planet = this.file();
    return !!planet && Object.values(planet.materials).some((m) => m.emissive !== null);
  });
  /** Whether the reviewed planet is lit (a style's light lights any). */
  protected readonly canLight = computed(() => {
    const planet = this.file();
    return !!planet && (!!planet.light || this.style() !== '');
  });
  /** Whether the reviewed planet has haze layers over its surface. */
  protected readonly canHaze = computed(() => {
    const planet = this.file();
    return !!planet && planet.parts.some((p) => p.role === 'layer');
  });

  constructor() {
    effect(() => this.background.setPageTints(backgroundTints(this.settings())));
    effect(() => {
      const id = this.review();
      if (!id) {
        this.background.setPagePlanets(null);
        return;
      }
      if (!this.file()) return; // its own settings aren't known yet: the last planet stays till they are
      const v = this.values();
      this.background.setPagePlanets([
        {
          id,
          position: REVIEW_POSITION,
          radius: REVIEW_RADIUS,
          style: v.style || undefined,
          glow: v.glow,
          lighting: v.lighting,
          shade: { strength: v.shade },
          strengths: { layer: v.haze, shield: v.shield, ring: v.ring },
          glows: { shield: v.shieldGlow },
          spreads: { shield: v.shieldSpread },
          scales: { shield: v.shieldScale },
          cuts: { shield: v.shieldCut },
        },
      ]);
    });
    effect(() => {
      const choices: PageChoices = {
        review: this.review(),
        names: this.names(),
        panel: this.panel(),
        settings: this.settings(),
        planets: this.choices(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
      } catch {
        // nowhere to keep them: the page still works
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.background.setPageTints(null);
      this.background.setPagePlanets(null);
    });
  }

  /** The style the reviewed planet is shown in, chosen here. */
  protected setStyle(style: string): void {
    const id = this.review();
    if (!id) return;
    this.choices.update((all) => ({ ...all, [id]: { ...all[id], style } }));
  }

  /** A setting of the reviewed planet in the style it is shown in, set here. */
  protected set<K extends keyof VariantChoices>(key: K, value: VariantChoices[K]): void {
    const id = this.review();
    if (!id) return;
    const style = this.style();
    this.choices.update((all) => {
      const planet = all[id] ?? {};
      const variant = planet.variants?.[style] ?? {};
      return {
        ...all,
        [id]: { ...planet, variants: { ...planet.variants, [style]: { ...variant, [key]: value } } },
      };
    });
  }

  /** The reviewed planet, in the style it is shown in, back to its own settings. */
  protected reset(): void {
    const id = this.review();
    const style = this.style();
    this.choices.update((all) => {
      const planet = all[id];
      if (!planet?.variants) return all;
      const variants = { ...planet.variants };
      delete variants[style];
      return { ...all, [id]: { ...planet, variants } };
    });
  }

  /**
   * Back to the page this one was opened from; to the start when it was opened on its own (the
   * site's first navigation landed here: history before it isn't the site's).
   */
  protected back(): void {
    const id = (this.location.getState() as { navigationId?: number } | null)?.navigationId ?? 1;
    if (id > 1) this.location.back();
    else void this.router.navigateByUrl('/');
  }

  /** Another set of planets, flown to. */
  protected anotherSet(): void {
    this.background.nextPlanetSet();
  }

  /** A preset tints the whole background; the planets follow it. */
  protected choose(preset: TintPreset): void {
    const colour = preset.token
      ? getComputedStyle(this.root).getPropertyValue(preset.token).trim()
      : '#ffffff';
    this.settings.set({
      ...UNTINTED,
      background: { on: preset.token !== null, colour, blend: preset.blend },
    });
  }
}
