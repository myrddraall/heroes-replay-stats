import { Component, computed, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { RenderApi, TintPreset } from '@myrddraall/heroes-replay-stats-aether';
import {
  FPS_RANGE,
  type GraphicsSettings as EngineSettings,
  INTERACTING_FPS_RANGE,
  QUALITIES,
  type Quality,
  RESOLUTION_RANGE,
} from '@myrddraall/heroes-replay-stats-aether/graphics';
import type { BackgroundColour, ColourMode } from '../../data/settings/background-colour.store';
import { SettingSlider } from '@myrddraall/heroes-replay-stats-settings/ui';

/** What the Graphics settings show: the engine's, and the background's colour. */
export type GraphicsSettings = EngineSettings & BackgroundColour;

export const QUALITY_LABELS: Readonly<Record<Quality, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
  extreme: 'Extreme',
};

/** A setting set with a slider. */
interface SliderSetting {
  readonly key: 'idleFps' | 'animationFps' | 'interactingFps' | 'resolution';
  readonly label: string;
  readonly range: { readonly min: number; readonly max: number };
  readonly step: number;
  readonly unit: 'fps' | '%' | '';
  readonly hint: string;
}

/** The background's sliders, among the quality's values. */
const QUALITY_SLIDERS: readonly SliderSetting[] = [
  {
    key: 'idleFps',
    label: 'Idle frame rate',
    range: FPS_RANGE,
    step: 1,
    unit: 'fps',
    hint: 'The most frames a second the background draws while it just moves.',
  },
  {
    key: 'animationFps',
    label: 'Animation frame rate',
    range: FPS_RANGE,
    step: 1,
    unit: 'fps',
    hint: 'The most while it fades to a new colour.',
  },
  {
    key: 'interactingFps',
    label: 'Interacting frame rate',
    range: INTERACTING_FPS_RANGE,
    step: 1,
    unit: 'fps',
    hint: 'The most while you drag or zoom a map, so the map gets the machine; at 0 the background stops until you let go.',
  },
  {
    key: 'resolution',
    label: 'Background resolution',
    range: RESOLUTION_RANGE,
    step: 0.05,
    unit: '%',
    hint: "The share of the display's resolution the background is drawn at.",
  },
];

/**
 * The Graphics settings (presentational): a quality preset, its values, the background's colour,
 * and what the background draws with.
 */
@Component({
  selector: 'hrs-graphics-form',
  imports: [MatButtonToggleModule, MatSelectModule, MatSlideToggleModule, SettingSlider],
  templateUrl: './graphics-form.html',
  styleUrl: './graphics-form.scss',
})
export class GraphicsForm {
  readonly settings = input.required<GraphicsSettings>();
  /** The preset the settings are at; custom when at none. */
  readonly quality = input.required<Quality | 'custom'>();
  /** Whether there is a custom quality to go back to (Custom can be chosen then). */
  readonly hasCustom = input(false);
  /** The colours the background can be in. */
  readonly colours = input.required<readonly TintPreset[]>();
  /** The user chose a quality preset, or the last custom quality. */
  readonly qualityChosen = output<Quality | 'custom'>();
  /** The user changed settings. */
  readonly changed = output<Partial<GraphicsSettings>>();

  protected readonly qualities = QUALITIES;
  protected readonly qualityLabels = QUALITY_LABELS;
  protected readonly qualitySliders = computed(() => this.rows(QUALITY_SLIDERS));
  protected readonly apis: readonly { value: RenderApi; label: string }[] = [
    { value: 'auto', label: 'Automatic' },
    { value: 'webgpu', label: 'WebGPU' },
    { value: 'webgl2', label: 'WebGL 2' },
  ];
  protected readonly colourModes: readonly { value: ColourMode; label: string }[] = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'random', label: 'Random' },
    { value: 'in-turn', label: 'In turn' },
  ];

  /** The sliders with their values, and those as shown. */
  private rows(sliders: readonly SliderSetting[]) {
    const settings = this.settings();
    return sliders.map((slider) => {
      const value = settings[slider.key];
      const shown =
        slider.unit === 'fps'
          ? value === 0
            ? 'stopped'
            : `${value} fps`
          : slider.unit === '%'
            ? `${Math.round(value * 100)}%`
            : value.toFixed(2);
      return { ...slider, value, shown };
    });
  }

  protected change(key: SliderSetting['key'], value: number): void {
    this.changed.emit({ [key]: value });
  }
}
