import type { HeroDataSet } from '@myrddraall/hero-data';
import type { MapAssets, MapViewModel, PackImage } from '@myrddraall/heroes-replay-stats-map';

/**
 * One of the pack's pictures at each size it has it, for an `<img>` to take the smallest that is
 * sharp where it draws it: `src` the largest, `srcset` every one by its width.
 */
export interface MapPicture {
  readonly src: string;
  readonly srcset: string;
  /** Its full size in pixels. */
  readonly width: number;
  readonly height: number;
}

/** A map objective as hero-data describes it, with its icons (the pack's). */
export interface MapObjectiveInfo {
  readonly title: string;
  readonly description: string | null;
  readonly icons: readonly MapPicture[];
}

/** What hero-data adds to a map's facts: its objectives. Nothing for a map it doesn't know. */
export interface MapExtraInfo {
  readonly known: boolean;
  readonly objectives: readonly MapObjectiveInfo[];
}

/** The map's loading-screen pictures in its pack: the picture, and its icons by name. */
export interface MapArt {
  readonly loadingScreen: MapPicture | null;
  /** By the game file's name, lower case, without its extension (iconName). */
  readonly icons: ReadonlyMap<string, MapPicture>;
}

const NOTHING: MapExtraInfo = { known: false, objectives: [] };

/** A picture's name for matching: the file's name, lower case, without its folder or extension. */
export function iconName(file: string): string {
  return (file.split(/[\\/]/).pop() ?? file).replace(/\.[^.]+$/, '').toLowerCase();
}

function pictureOf(image: PackImage, assets: MapAssets): MapPicture {
  const versions = [image, ...(image.smaller ?? [])];
  return {
    src: assets.url(image.file),
    srcset: versions.map((v) => `${assets.url(v.file)} ${v.size[0]}w`).join(', '),
    width: image.size[0],
    height: image.size[1],
  };
}

/** The loading screen and its icons the pack has (PACK.md, Images). */
export function mapArtOf(map: MapViewModel | null): MapArt {
  if (!map) return { loadingScreen: null, icons: new Map() };
  const { loadingScreen, loadingScreenIcons } = map.pack.images;
  return {
    loadingScreen: loadingScreen ? pictureOf(loadingScreen, map.assets) : null,
    icons: new Map(
      (loadingScreenIcons ?? []).map((icon) => [
        iconName(icon.source ?? icon.file),
        pictureOf(icon, map.assets),
      ]),
    ),
  };
}

/**
 * Hero-data's side of a map's facts, by the map's English name (the pack's `map.name`, which is
 * what `HeroDataSet.map` takes): its objectives, each with the pack's icons hero-data names (an
 * icon the pack hasn't is left out). Nothing while the data hasn't loaded or for a map it doesn't
 * know.
 */
export function mapExtraInfoOf(
  name: string,
  data: HeroDataSet | undefined,
  art: MapArt,
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
        icons: o.icons.flatMap((icon) => art.icons.get(iconName(icon)) ?? []),
      })),
  };
}
