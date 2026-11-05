import { Component, computed, input, output, signal } from '@angular/core';
import { form, FormField, validate } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOptgroup, MatOption, MatSelect } from '@angular/material/select';

/** The select's value for columns that match no preset (no preset name can be empty). */
const CUSTOM = '';

/**
 * Named choices of stat columns (presentational): pick a built-in or saved one; once the columns
 * are changed so no preset matches (`current` null), name and save them, and delete a saved one.
 */
@Component({
  selector: 'ui-stat-presets',
  imports: [
    FormField,
    MatError,
    MatButton,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatOptgroup,
    MatOption,
    MatSelect,
  ],
  templateUrl: './stat-presets.html',
  styleUrl: './stat-presets.scss',
})
export class StatPresets {
  readonly builtIn = input.required<readonly string[]>();
  readonly saved = input.required<readonly string[]>();
  /** The preset the columns match; null when they match none. */
  readonly current = input.required<string | null>();

  readonly chosen = output<string>();
  /** Save the current columns under this name. */
  readonly saveRequested = output<string>();
  readonly deleteRequested = output<string>();

  protected readonly custom = computed(() => this.current() === null);
  /** What the select shows: the preset, or Custom when none matches. */
  protected readonly selected = computed(() => this.current() ?? CUSTOM);
  protected readonly currentIsSaved = computed(() => {
    const current = this.current();
    return current !== null && this.saved().includes(current);
  });

  private readonly naming = signal({ name: '' });
  protected readonly nameForm = form(this.naming, (path) => {
    validate(path.name, ({ value }) => {
      const name = value().trim();
      if (name === '') return { kind: 'blank', message: 'Name the preset' };
      return this.builtIn().includes(name)
        ? { kind: 'builtIn', message: 'A built-in preset has that name' }
        : null;
    });
  });

  protected choose(name: string): void {
    if (name !== CUSTOM) this.chosen.emit(name);
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.nameForm().invalid()) return;
    this.saveRequested.emit(this.naming().name.trim());
    this.naming.set({ name: '' });
    this.nameForm().reset();
  }
}
