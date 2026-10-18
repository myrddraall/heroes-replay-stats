import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { DraftDesignStore } from '../draft-design.store';
import { Editor } from './editor';
import { type EditorMode, EditorUiStore } from './editor-ui.store';

/**
 * The editor's bar (container, on the page's stores and the `Editor` in effect): which layer is
 * edited (a scene, or the library), Save (the draft published: the site shows it) and Discard (the
 * published design again), with how many things are not saved yet, and the view's options behind
 * a gear (the names; everything in the layer edited reset, confirmed first).
 */
@Component({
  selector: 'hrs-editor-bar',
  imports: [MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip],
  templateUrl: './editor-bar.html',
  styleUrl: './editor-bar.scss',
})
export class EditorBar {
  protected readonly ui = inject(EditorUiStore);
  protected readonly draft = inject(DraftDesignStore);
  protected readonly editor = inject(Editor);
  protected readonly modes: readonly { mode: EditorMode; label: string }[] = [
    { mode: 'scene', label: 'Scene' },
    { mode: 'library', label: 'Library' },
  ];
}
