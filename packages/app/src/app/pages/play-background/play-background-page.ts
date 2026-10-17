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
 * settings (style, glow, light, shade, haze): each planet keeps its own, over what its file and
 * its style give it, and Reset gives those back. The planets' names float over them here unless
 * switched off. The page's choices (review, names, tints, each planet's settings) are kept
 * across visits.
 */
/** Where a planet is put to review it: in the middle of the view, filling much of it. */
const REVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const REVIEW_RADIUS = 18;
/** Where the page's choices are kept. */
const STORAGE_KEY = 'hrs.background-page';

/** A planet's settings on this page, each where it was set here (else the planet's own apply). */
interface PlanetChoices {
  readonly style?: string;
  readonly glow?: number;
  readonly lighting?: number;
  readonly shade?: number;
  readonly haze?: number;
}

/** A planet's settings as shown: its own, over its file's tuning, over the defaults. */
interface PlanetValues {
  readonly style: string;
  readonly glow: number;
  readonly lighting: number;
  readonly shade: number;
  readonly haze: number;
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
  /** The reviewed planet's settings set here. */
  private readonly chosen = computed(() => this.choices()[this.review()] ?? {});
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
    () => this.chosen().style ?? this.file()?.tuning?.style ?? '',
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
    const styleShade = this.styled.hasValue() ? this.styled.value().shade : undefined;
    return {
      style: this.style(),
      glow: chosen.glow ?? tuning?.glow ?? 0,
      lighting: chosen.lighting ?? tuning?.lighting ?? 1,
      shade:
        chosen.shade ??
        tuning?.shade?.strength ??
        styleShade?.strength ??
        DEFAULT_SHADE.strength,
      haze: chosen.haze ?? tuning?.strengths?.layer ?? DEFAULT_STRENGTHS.layer ?? 1,
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
          strengths: { layer: v.haze },
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

  /** A setting of the reviewed planet, set here. */
  protected set<K extends keyof PlanetChoices>(key: K, value: PlanetChoices[K]): void {
    const id = this.review();
    if (!id) return;
    this.choices.update((all) => ({ ...all, [id]: { ...all[id], [key]: value } }));
  }

  /** The reviewed planet back to its own settings. */
  protected reset(): void {
    const id = this.review();
    this.choices.update((all) => {
      const rest = { ...all };
      delete rest[id];
      return rest;
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
