/**
 * platonic.ts — the 2 Platonic solids not already covered by the deltahedra
 * family. The tetrahedron, octahedron, and icosahedron are each *both* a
 * Platonic solid and a deltahedron (all-equilateral-triangle faces) —
 * they're D4/D8/D20 in ./deltahedra.ts and are not re-derived here.
 *
 * Cube and dodecahedron both have non-triangular regular faces (squares,
 * pentagons), so this is where PolyhedronSpec.faces first needs more than 3
 * entries per face. Both shapes were cross-checked against a true 3D
 * convex-hull computation (Python's scipy.spatial.ConvexHull, not the
 * "top-k vertices by dot product with a guessed face normal" heuristic that
 * was tried first for the dodecahedron and produced non-planar, wrong-vertex
 * faces — coplanar hull triangles were grouped by their shared plane
 * equation instead): vertex count, edge count, face count, per-vertex
 * degree, face planarity, and edge-length uniformity all verified directly.
 */

import { type Vec3, type PolyhedronSpec, makeSpec } from './core';

// ---------------------------------------------------------------------------
// CUBE
// ---------------------------------------------------------------------------

function rawCube(): Vec3[] {
  const verts: Vec3[] = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) verts.push([sx, sy, sz]);
    }
  }
  return verts;
}
const EDGES_CUBE: [number, number][] = [
  [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3],
  [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
];
const FACES_CUBE: number[][] = [
  [1, 0, 2, 3], [6, 4, 5, 7], [4, 0, 1, 5],
  [3, 2, 6, 7], [2, 0, 4, 6], [5, 1, 3, 7],
];

// ---------------------------------------------------------------------------
// DODECAHEDRON
// ---------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

function rawDodecahedron(): Vec3[] {
  const verts: Vec3[] = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) verts.push([sx, sy, sz]);
    }
  }
  for (const sy of [1, -1]) {
    for (const sz of [1, -1]) verts.push([0, sy * INV_PHI, sz * PHI]);
  }
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) verts.push([sx * INV_PHI, sy * PHI, 0]);
  }
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) verts.push([sx * PHI, 0, sz * INV_PHI]);
  }
  return verts;
}
const EDGES_DODECAHEDRON: [number, number][] = [
  [0, 8], [0, 12], [0, 16], [1, 9], [1, 12], [1, 17], [2, 10], [2, 13], [2, 16], [3, 11], [3, 13], [3, 17],
  [4, 8], [4, 14], [4, 18], [5, 9], [5, 14], [5, 19], [6, 10], [6, 15], [6, 18], [7, 11], [7, 15], [7, 19],
  [8, 10], [9, 11], [12, 14], [13, 15], [16, 17], [18, 19],
];
const FACES_DODECAHEDRON: number[][] = [
  [7, 19, 5, 9, 11],
  [14, 12, 1, 9, 5],
  [19, 18, 4, 14, 5],
  [10, 8, 4, 18, 6],
  [15, 13, 2, 10, 6],
  [7, 15, 6, 18, 19],
  [17, 16, 2, 13, 3],
  [11, 9, 1, 17, 3],
  [7, 11, 3, 13, 15],
  [1, 12, 0, 16, 17],
  [2, 16, 0, 8, 10],
  [4, 8, 0, 12, 14],
];

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

export const PLATONIC_ADDITIONS: Record<string, PolyhedronSpec> = {
  CUBE: makeSpec('CUBE', 'cube', 6, rawCube(), EDGES_CUBE, FACES_CUBE),
  DODECAHEDRON: makeSpec('DODECAHEDRON', 'dodecahedron', 12, rawDodecahedron(), EDGES_DODECAHEDRON, FACES_DODECAHEDRON),
};

export const PLATONIC_ADDITION_IDS = Object.keys(PLATONIC_ADDITIONS);
