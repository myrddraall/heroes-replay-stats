import type { LibraryState } from '../library/library';
import type { ScenesState } from '../scenes/scenes';

export interface Design {
  readonly library: LibraryState;
  readonly scenes: ScenesState;
}
