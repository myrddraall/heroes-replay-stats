import { Component, computed, input } from '@angular/core';
import { MatTreeModule } from '@angular/material/tree';
import { RouterLink } from '@angular/router';
import type { ShellNavNode } from '../../model';

/**
 * Every level of navigation as one tree (presentational; the theme's NavTree on `mat-tree`, the
 * handset's nav drawer): nested nodes, each a link, the current page's branch open and lit, the
 * others closed. The tree's keys move between nodes; Enter follows a node's link.
 */
@Component({
  selector: 'hrs-nav-tree',
  imports: [MatTreeModule, RouterLink],
  templateUrl: './nav-tree.html',
})
export class NavTree {
  readonly nodes = input.required<readonly ShellNavNode[]>();
  /** Material's tree takes mutable arrays. */
  protected readonly data = computed(() => [...this.nodes()]);
  protected readonly children = (node: ShellNavNode) => [...node.children];
  protected readonly key = (node: ShellNavNode) => node.link;
  /** A node is rebuilt when the navigation changes (its children with it), kept open by its key. */
  protected readonly sameNode = (_: number, node: ShellNavNode) => node;
}
