import type { HeroDataSet, HeroesImages } from '@myrddraall/hero-data';

/** A map objective as hero-data describes it, with its icons' URLs. */
export interface MapObjectiveInfo {
  readonly title: string;
  readonly description: string | null;
  readonly iconUrls: readonly string[];
}

/** What hero-data adds to a map's facts: its objectives and art. Nothing for a map it doesn't know. */
export interface MapExtraInfo {
  readonly known: boolean;
  readonly objectives: readonly MapObjectiveInfo[];
  readonly images: {
    readonly replayPreview: string | null;
    readonly loadingScreen: string | null;
  };
}

const NOTHING: MapExtraInfo = {
  known: false,
  objectives: [],
  images: { replayPreview: null, loadingScreen: null },
};

/**
 * Hero-data's side of a map's facts, by the map's English name (the pack's `map.name`, which is
 * what `HeroDataSet.map` takes). Nothing while the data hasn't loaded or for a map it doesn't know.
 */
export function mapExtraInfoOf(
  name: string,
  data: HeroDataSet | undefined,
  images: HeroesImages,
): MapExtraInfo {
  const info = data?.map(name);
  if (!info) return NOTHING;
  return {
    known: true,
    objectives: info.objectives
      .filter((o) => o.title)
      .map((o) => ({
        title: o.title ?? '',
        description: o.description,
        iconUrls: o.icons.map((icon) => images.mapObjective(icon)),
      })),
    images: {
      replayPreview: images.map(info, 'replayPreview'),
      loadingScreen: images.map(info, 'loadingScreen'),
    },
  };
}
