import { Component, computed, input } from '@angular/core';
import { MatTreeModule } from '@angular/material/tree';
import { RouterLink } from '@angular/router';
import type { ShellNavNode } from '../../model';

/**
 * Every level of navigation as one tree (presentational; the theme's NavTree on `mat-tree`, the
 * handset's nav drawer): nested nodes, each a link, the current page's branch open and lit, the
 * others closed. The tree's keys move between nodes; Enter follows a node's link. Every area has
 * its chevron, whether it has sections or not; other nodes only when they have children.
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
  /** The areas: the top-level nodes before the utilities. */
  protected readonly areas = computed(() => {
    const nodes = this.nodes();
    const utilities = nodes.findIndex((n) => n.breaks);
    return new Set(utilities < 0 ? nodes : nodes.slice(0, utilities));
  });
  protected readonly children = (node: ShellNavNode) => [...node.children];
  protected readonly key = (node: ShellNavNode) => node.link;
  /** A node is rebuilt when the navigation changes (its children with it), kept open by its key. */
  protected readonly sameNode = (_: number, node: ShellNavNode) => node;
}
