import { REFERENCE_KEY } from './editing-aids.store';
import type { TreeRow } from '../tree/scene-tree';

/** The keys and rows of what an editor's tree shows of a material (its layers, its shader's groups). */

/** The reference image's row: an editing aid, after what is edited, in either editor's tree. */
export const referenceRow = (): TreeRow => ({
  key: REFERENCE_KEY,
  label: 'Reference',
  icon: 'compare',
  depth: 0,
  expandable: false,
  expanded: false,
  aid: true,
});
