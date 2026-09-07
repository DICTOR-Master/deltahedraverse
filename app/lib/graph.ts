/**
 * Stage 8 — pure graph-logic helpers over the assembly graph. No geometry,
 * no Three.js: these operate only on node ids and connection endpoints, so
 * they're independently testable (see scripts/verify-graph.ts) and reusable
 * regardless of how the graph ends up rendered.
 */

import type { Assembly, AssemblyConnection } from './assembly';

/**
 * Every connection is created by confirmAttach() as (existing node -> new
 * node), i.e. nodeA is always the parent, nodeB the child — so the graph the
 * app can currently build is always a rooted tree/forest. Returns the given
 * node plus every node reachable by following nodeA -> nodeB edges
 * (its full subtree, itself included).
 */
export function collectSubtree(connections: AssemblyConnection[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const c of connections) {
    if (!childrenOf.has(c.nodeA)) childrenOf.set(c.nodeA, []);
    childrenOf.get(c.nodeA)!.push(c.nodeB);
  }

  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}

/** The one connection where `nodeId` is the child (nodeB) — undefined for the root. */
export function findParentConnection(connections: AssemblyConnection[], nodeId: string): AssemblyConnection | undefined {
  return connections.find((c) => c.nodeB === nodeId);
}

/**
 * True if the assembly's connections, treated as undirected edges between
 * nodeA and nodeB, contain a cycle (the graph is not a forest) — a "closed
 * cage" in construction-kit terms. Standard union-find over connections.
 *
 * Currently unreachable through this app's own UI: every attach spawns a
 * brand-new node (confirmAttach never links two already-placed nodes), so
 * the graph this app can build today is always a tree, and this will always
 * return false on it. Implemented and unit-tested now (scripts/verify-graph.ts,
 * hand-built cyclic and acyclic graphs) so a future "connect two existing
 * free vertices" interaction has a correct, ready primitive rather than a
 * placeholder — noted honestly rather than left undocumented.
 */
export function hasCycle(assembly: Assembly): boolean {
  const parent = new Map<string, string>();
  for (const node of assembly.nodes) parent.set(node.id, node.id);

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  for (const conn of assembly.connections) {
    if (!parent.has(conn.nodeA) || !parent.has(conn.nodeB)) continue; // dangling reference, not this function's concern
    const rootA = find(conn.nodeA);
    const rootB = find(conn.nodeB);
    if (rootA === rootB) return true;
    parent.set(rootA, rootB);
  }
  return false;
}
