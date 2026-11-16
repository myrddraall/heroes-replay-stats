import { Component, computed, input, output } from '@angular/core';
import {
  BLENDS,
  type GradientStop,
  MAX_STOPS,
  type TintBlend,
  type TintLayer,
  type TintMask,
  type TintMaskChannel,
  type TintMaskLayer,
  type ToneRange,
} from '@myrddraall/heroes-replay-stats-aether/tints';
import { BLEND_OPTIONS } from './blend-options';
import { PropertyColour } from '../controls/rows/property-colour';
import { PropertyCheck } from '../controls/rows/property-check';
import { PropertyNumber } from '../controls/rows/property-number';
import { PropertySelect, type PropertyOption } from '../controls/rows/property-select';
import { PropertyText } from '../controls/rows/property-text';
import { TINT_KIND_LABELS } from './tint-rows';

const STAGES: readonly PropertyOption[] = [
  { value: 'result', label: 'After lighting' },
  { value: 'surface', label: 'Before lighting' },
];
const MASKS: readonly PropertyOption[] = [
  { value: 'none', label: 'None' },
  { value: 'layer', label: 'Layer' },
  { value: 'facing', label: 'Edge' },
];
const LAYERS: readonly PropertyOption[] = [
  { value: 'diffuse', label: 'Diffuse' },
  { value: 'emissive', label: 'Emissive' },
  { value: 'mask1', label: 'Mask 1' },
  { value: 'mask2', label: 'Mask 2' },
];
const CHANNELS: readonly PropertyOption[] = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
  { value: 'a', label: 'Alpha' },
  { value: 'luma', label: 'Brightness' },
];

/** A tint without one of its settings (it goes back to what it is unset). */
function without(tint: TintLayer, key: 'name' | 'stage' | 'mask'): TintLayer {
  const out = { ...tint };
  delete out[key];
  return out;
}

/**
 * One tint's settings (presentational), as its kind has them: a colour and how it blends; a hue
 * turn, saturation and lightness; a gradient's stops; a scene's grading's white balance,
 * brightness and contrast, lift/gamma/gain, levels, or a colour of the theme (`themes`). Then how
 * strongly, and (an object's, not a scene's grading) before or after lighting and where it is on
 * (its mask). Each change is the whole tint as it is to be.
 */
@Component({
  selector: 'forge-tint-settings',
  imports: [PropertyColour, PropertyCheck, PropertyNumber, PropertySelect, PropertyText],
  templateUrl: './tint-settings.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class TintSettings {
  readonly tint = input.required<TintLayer>();
  /** Whether it is a scene's grading (none before lighting, or masked). */
  readonly grading = input(false);
  /** The theme's colours a theme colour is chosen from, by preset id. */
  readonly themes = input<readonly PropertyOption[]>([]);
  readonly tintChange = output<TintLayer>();
  protected readonly blends = BLEND_OPTIONS;
  protected readonly stages = STAGES;
  protected readonly masks = MASKS;
  protected readonly layers = LAYERS;
  protected readonly channels = CHANNELS;
  protected readonly maxStops = MAX_STOPS;
  protected readonly kindLabel = computed(() => TINT_KIND_LABELS[this.tint().kind]);

  protected change(change: Partial<TintLayer>): void {
    this.tintChange.emit({ ...this.tint(), ...change } as TintLayer);
  }

  protected rename(name: string): void {
    const rest = without(this.tint(), 'name');
    this.tintChange.emit(name.trim() ? { ...rest, name: name.trim() } : rest);
  }

  protected blend(blend: string): void {
    if (BLENDS.includes(blend as TintBlend)) this.change({ blend: blend as TintBlend });
  }

  protected stage(stage: string): void {
    const rest = without(this.tint(), 'stage');
    this.tintChange.emit(stage === 'surface' ? { ...rest, stage: 'surface' } : rest);
  }

  protected maskKind(kind: string): void {
    const rest = without(this.tint(), 'mask');
    const mask: TintMask | undefined =
      kind === 'layer'
        ? { by: 'layer', layer: 'diffuse', channel: 'luma' }
        : kind === 'facing'
          ? { by: 'facing', from: 0.5, to: 1 }
          : undefined;
    this.tintChange.emit(mask ? { ...rest, mask } : rest);
  }

  protected maskChange(change: Partial<TintMask>): void {
    const mask = this.tint().mask;
    if (mask) this.change({ mask: { ...mask, ...change } as TintMask });
  }

  protected maskLayer(layer: string): void {
    this.maskChange({ layer: layer as TintMaskLayer });
  }

  protected maskChannel(channel: string): void {
    this.maskChange({ channel: channel as TintMaskChannel });
  }

  /** One of lift/gamma/gain's ranges changed. */
  protected rangeChange(range: 'lift' | 'gamma' | 'gain', change: Partial<ToneRange>): void {
    const t = this.tint();
    if (t.kind === 'lift-gamma-gain') this.change({ [range]: { ...t[range], ...change } });
  }

  protected stopChange(index: number, change: Partial<GradientStop>): void {
    const t = this.tint();
    if (t.kind !== 'gradient') return;
    this.change({ stops: t.stops.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  }

  /** A stop added halfway between the last two (the gradient as it was there). */
  protected addStop(): void {
    const t = this.tint();
    if (t.kind !== 'gradient' || t.stops.length >= MAX_STOPS) return;
    const sorted = [...t.stops].sort((a, b) => a.at - b.at);
    const [a, b] = [sorted.at(-2), sorted.at(-1)];
    const at = a && b ? (a.at + b.at) / 2 : 0.5;
    this.change({ stops: [...t.stops, { at, colour: b?.colour ?? '#ffffff' }] });
  }

  protected removeStop(index: number): void {
    const t = this.tint();
    if (t.kind !== 'gradient' || t.stops.length <= 2) return;
    this.change({ stops: t.stops.filter((_, i) => i !== index) });
  }
}
