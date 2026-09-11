/**
 * The assembly graph — Stage 6's real data structure. Built directly from
 * user actions (placeRoot / confirmAttach in ShapeViewer.tsx), never
 * inferred by walking the Three.js scene. The scene is a rendering of this
 * graph, not the other way around.
 */

import { POLYHEDRA } from './polyhedra';
import { FOURD_CAPABLE_IDS } from './polyhedra/fourD';

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
  // 'vertex' (default, when absent — every connection before face-snap
  // mode existed was implicitly this kind) means vertexA/vertexB are
  // vertex indices, the original ball-joint connection. 'face' means
  // they're face indices instead — a face-to-face join, only valid
  // between two faces of the same size (see app/lib/polyhedra/core.ts's
  // FaceConnector / buildFaceConnectors). 'duoprism' also uses face
  // indices, but for a structurally different join (see duoprism.ts):
  // nodeB is an identical-orientation TRANSLATED copy of nodeA (not a
  // mirrored flush attach), connected by a real 3D wall-prism cell —
  // vertexA and vertexB are always the SAME face index (the two nodes
  // share the same shape by construction), never independently chosen.
  // Reusing vertexA/vertexB rather than adding separate faceA/faceB
  // fields keeps exactly one pair of "which connector on each side"
  // fields, disambiguated by this tag, instead of two pairs where only
  // one is ever meaningful at a time.
  kind?: 'vertex' | 'face' | 'duoprism';
  // Set by Stage 7's rewrite rule when a node's shape changes and no
  // compatible vertex exists on the new shape for this connection's side.
  // vertexA/vertexB then keep their last-known (possibly now out-of-range
  // for the new shape) value purely as a historical record — orphaned
  // connections are excluded from vertex-range validation and from
  // occupied-vertex bookkeeping on load. (Rewrite only ever produces
  // 'vertex' connections — the D10<->D12 rule doesn't touch faces.)
  orphaned?: boolean;
  // 4D extension: this face-attach used the real 4D dihedral fold
  // (app/lib/polyhedra/fold4.ts) instead of an ordinary flush-3D join.
  // Additive optional field, same proven pattern as `kind`/`orphaned`
  // before it — old saves keep validating with zero migration. Only
  // ever true for a 'face' connection between two nodes of the SAME
  // FOURD_CAPABLE_IDS shape (Stage-1 scope: a genuine two-different-
  // 4D-shape attach raises "whose dihedral angle governs the fold" with
  // no single clean answer — deferred). The angle/axis of the fold are
  // never stored here — both are always re-derived at render time from
  // `node.shape` + this connection's own face index, matching fourD.ts's
  // own "derive, don't duplicate" rule.
  fold4?: true;
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
  if (c.kind !== undefined && c.kind !== 'vertex' && c.kind !== 'face' && c.kind !== 'duoprism') return false;
  if (c.orphaned !== undefined && typeof c.orphaned !== 'boolean') return false;
  // Structural check only (no node/shape cross-reference here -- that
  // needs isValidAssembly below, which has nodeById available): fold4
  // can only ever accompany a face-kind connection.
  if (c.fold4 !== undefined && (c.fold4 !== true || c.kind !== 'face')) return false;
  return true;
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
    const isFaceLike = conn.kind === 'face' || conn.kind === 'duoprism';
    const countA = isFaceLike ? POLYHEDRA[a.shape].faces.length : POLYHEDRA[a.shape].vertices.length;
    const countB = isFaceLike ? POLYHEDRA[b.shape].faces.length : POLYHEDRA[b.shape].vertices.length;
    if (conn.vertexA < 0 || conn.vertexA >= countA) return false;
    if (conn.vertexB < 0 || conn.vertexB >= countB) return false;
    // 4D extension, Stage-1 scope: fold4 only ever means something for a
    // self-attach (same shape both sides) of a shape that's actually
    // FOURD_CAPABLE_IDS-eligible -- cross-referencing both nodes here is
    // exactly why this lives in isValidAssembly, not the structural-only
    // isConnection above.
    if (conn.fold4 && (a.shape !== b.shape || !FOURD_CAPABLE_IDS.includes(a.shape))) return false;
    // Duoprism: same restriction as fold4 (self-attach only, FOURD-
    // capable shapes only — see duoprism.ts's own header comment for why
    // it's still gated to these 4 even though the geometry itself would
    // work for any shape: a deliberate scope match with the other 4D
    // feature, not a mathematical requirement), PLUS vertexA must equal
    // vertexB — a duoprism's far node is a translated copy of the near
    // one, so there's only ever one "the same face on both sides" role,
    // never two independently-chosen face indices.
    if (conn.kind === 'duoprism' && (a.shape !== b.shape || !FOURD_CAPABLE_IDS.includes(a.shape) || conn.vertexA !== conn.vertexB)) return false;
  }
  return true;
}
