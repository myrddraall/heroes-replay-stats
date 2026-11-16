import { inject, InjectionToken, Service } from '@angular/core';

/**
 * Where reports a page sends go (its results, to be read where the app is developed): the dev
 * server's `/dev-reports/` in the `local` configuration (`pnpm run serve.reports` keeps them), or
 * nowhere (null).
 */
export const DEV_REPORTS_URL = new InjectionToken<string | null>('DEV_REPORTS_URL', {
  providedIn: 'root',
  factory: () => null,
});

/** Reports sent where they go (see `DEV_REPORTS_URL`): a report not taken is left, never holding anything up. */
@Service()
export class DevReports {
  private readonly url = inject(DEV_REPORTS_URL);

  /** A report by name (its latest replaces the last), as plain text; `finished`: kept after the next too. */
  send(name: string, text: string, finished = false): void {
    if (!this.url) return;
    void fetch(`${this.url}${encodeURIComponent(name)}${finished ? '?keep' : ''}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: text,
    }).catch(() => undefined);
  }
}
