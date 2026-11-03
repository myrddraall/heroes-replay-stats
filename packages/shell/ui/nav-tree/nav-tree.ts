import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ShellNavNode } from '../../model';

/**
 * Every level of navigation as one tree (presentational; the theme's NavTree, the handset's nav
 * drawer): the current page's branch open and lit, the others closed.
 */
@Component({
  selector: 'hrs-nav-tree',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './nav-tree.html',
})
export class NavTree {
  readonly nodes = input.required<readonly ShellNavNode[]>();
}
