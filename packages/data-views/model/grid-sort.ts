/** A grid's order: by one column, lowest or highest first. */
export interface GridSort {
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}
