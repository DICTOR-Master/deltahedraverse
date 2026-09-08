/**
 * The assembly graph — Stage 6's real data structure. Built directly from
 * user actions (placeRoot / confirmAttach in ShapeViewer.tsx), never
 * inferred by walking the Three.js scene. The scene is a rendering of this
 * graph, not the other way around.
 */

import { POLYHEDRA } from './polyhedra';

export interface AssemblyNode {
  id: string;
  shape: string; // PolyhedronSpec id, e.g. 'D6' or 'CUBE'
  transform: {
    position: [number, number, number];
    quaternion: [number, number, number, number]; // x, y, z, w
  };
}

export interface AssemblyConnection {
  nodeA: string;
  vertexA: number;
  nodeB: string;
  vertexB: number;
  // Set by Stage 7's rewrite rule when a node's shape changes and no
  // compatible vertex exists on the new shape for this connection's side.
  // vertexA/vertexB then keep their last-known (possibly now out-of-range
  // for the new shape) value purely as a historical record — orphaned
  // connections are excluded from vertex-range validation and from
  // occupied-vertex bookkeeping on load.
  orphaned?: boolean;
}

export interface Assembly {
  nodes: AssemblyNode[];
  connections: AssemblyConnection[];
}

export function emptyAssembly(): Assembly {
  return { nodes: [], connections: [] };
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isQuat(v: unknown): v is [number, number, number, number] {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isNode(v: unknown): v is AssemblyNode {
  if (typeof v !== 'object' || v === null) return false;
  const n = v as Record<string, unknown>;
  if (typeof n.id !== 'string' || typeof n.shape !== 'string') return false;
  if (typeof n.transform !== 'object' || n.transform === null) return false;
  const t = n.transform as Record<string, unknown>;
  return isVec3(t.position) && isQuat(t.quaternion);
}

function isConnection(v: unknown): v is AssemblyConnection {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  if (
    typeof c.nodeA !== 'string' ||
    typeof c.nodeB !== 'string' ||
    typeof c.vertexA !== 'number' ||
    typeof c.vertexB !== 'number'
  ) {
    return false;
  }
  return c.orphaned === undefined || typeof c.orphaned === 'boolean';
}

/** Structural validation for untrusted input (the API route body, a fetch response). */
export function isAssembly(v: unknown): v is Assembly {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  return Array.isArray(a.nodes) && Array.isArray(a.connections) && a.nodes.every(isNode) && a.connections.every(isConnection);
}

/**
 * Beyond structural shape: every node's `shape` must be a real polyhedron id
 * (any family — see app/lib/polyhedra/index.ts) and every connection must
 * reference node ids and vertex indices that actually exist. Guards the
 * renderer against a corrupted or hand-edited save file crashing on load.
 */
export function isValidAssembly(v: unknown): v is Assembly {
  if (!isAssembly(v)) return false;
  const nodeById = new Map(v.nodes.map((n) => [n.id, n]));
  if (nodeById.size !== v.nodes.length) return false; // duplicate ids

  for (const node of v.nodes) {
    if (!(node.shape in POLYHEDRA)) return false;
  }
  for (const conn of v.connections) {
    const a = nodeById.get(conn.nodeA);
    const b = nodeById.get(conn.nodeB);
    if (!a || !b) return false;
    // Orphaned connections keep a deliberately stale vertex index (see
    // AssemblyConnection.orphaned) — only the node references matter for them.
    if (conn.orphaned) continue;
    if (conn.vertexA < 0 || conn.vertexA >= POLYHEDRA[a.shape].vertices.length) return false;
    if (conn.vertexB < 0 || conn.vertexB >= POLYHEDRA[b.shape].vertices.length) return false;
  }
  return true;
}
