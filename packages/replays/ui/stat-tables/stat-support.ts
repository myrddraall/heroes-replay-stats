import type { StatSupport } from '../../model';

/** How the tables name each kind of limited support, in their legend and to screen readers. */
export const STAT_SUPPORT_LABELS: Readonly<Record<Exclude<StatSupport, 'full'>, string>> = {
  partial: 'Some roles',
  flawed: 'Flawed',
  none: 'Not recorded',
};
