/**
 * archimedean.ts — a first batch of 3 Archimedean solids: cuboctahedron,
 * truncated tetrahedron, truncated octahedron. All three cross-checked
 * against a true 3D convex-hull computation (scipy.spatial.ConvexHull,
 * same method as the dodecahedron in ./platonic.ts): vertex count, edge
 * count, face count, per-vertex degree, face planarity, and edge-length
 * uniformity all verified directly, not assumed.
 *
 * Vertices are hardcoded literal arrays copied directly from the verifying
 * Python script's own printed output, not re-derived by a hand-written
 * generator function here — a first attempt used a fresh TypeScript
 * generator loop for the vertices while copying the edges/faces arrays from
 * Python's `sorted(set(...))`-ordered output. The two orderings didn't
 * match (Python's dedup-and-sort reorders vertices relative to whatever
 * order they were generated in), so the edge/face indices silently pointed
 * at the wrong physical vertices — validateShape() caught it immediately
 * (every edge length wrong, since edges connected unrelated vertex pairs),
 * but the fix is to never re-derive an ordering that has to match a
 * separately-computed index list: hardcode the exact vertex list the
 * indices were computed against.
 *
 * This first batch was picked for simple, low-transcription-risk
 * coordinates (small-integer permutations, or a direct edge-truncation of
 * an already-verified shape) — not because the rest of the 13 Archimedean
 * solids are out of scope. The remaining 10 include several with genuinely
 * harder coordinates (icosidodecahedron and the two solids built from it
 * need golden-ratio combinations; the snub cube and snub dodecahedron are
 * chiral and need a numerically-solved root, the same category of problem
 * D12's Q_D12 already handles for deltahedra) and are deliberately left for
 * a follow-up pass rather than rushed — see docs/build-plan.md.
 */

import { type Vec3, type PolyhedronSpec, makeSpec } from './core';

// ---------------------------------------------------------------------------
// CUBOCTAHEDRON — all permutations of (+-1, +-1, 0)
// ---------------------------------------------------------------------------

const VERTS_CUBOCTAHEDRON: Vec3[] = [
  [-1, -1, 0], [-1, 0, -1], [-1, 0, 1], [-1, 1, 0],
  [0, -1, -1], [0, -1, 1], [0, 1, -1], [0, 1, 1],
  [1, -1, 0], [1, 0, -1], [1, 0, 1], [1, 1, 0],
];
const EDGES_CUBOCTAHEDRON: [number, number][] = [
  [0, 1], [0, 2], [0, 4], [0, 5], [1, 3], [1, 4], [1, 6], [2, 3], [2, 5], [2, 7], [3, 6], [3, 7],
  [4, 8], [4, 9], [5, 8], [5, 10], [6, 9], [6, 11], [7, 10], [7, 11], [8, 9], [8, 10], [9, 11], [10, 11],
];
const FACES_CUBOCTAHEDRON: number[][] = [
  [6, 1, 3], [4, 0, 1], [2, 0, 5], [8, 4, 9], [9, 6, 11], [10, 5, 8], [3, 2, 7], [11, 7, 10],
  [1, 0, 2, 3], [5, 0, 4, 8], [4, 1, 6, 9], [10, 8, 9, 11], [6, 3, 7, 11], [7, 2, 5, 10],
];

// ---------------------------------------------------------------------------
// TRUNCATED TETRAHEDRON — truncate a regular tetrahedron 1/3 along each edge
// ---------------------------------------------------------------------------

const VERTS_TRUNCATED_TETRAHEDRON: Vec3[] = [
  [-1, -1 / 3, 1 / 3], [-1, 1 / 3, -1 / 3],
  [-1 / 3, -1, 1 / 3], [-1 / 3, -1 / 3, 1],
  [-1 / 3, 1 / 3, -1], [-1 / 3, 1, -1 / 3],
  [1 / 3, -1, -1 / 3], [1 / 3, -1 / 3, -1],
  [1 / 3, 1 / 3, 1], [1 / 3, 1, 1 / 3],
  [1, -1 / 3, -1 / 3], [1, 1 / 3, 1 / 3],
];
// Derived mechanically from FACES_TRUNCATED_TETRAHEDRON's own boundary
// edges (dedup every face's consecutive vertex pairs) rather than hand-
// transcribed a second time — see this file's header for why a hand
// transcription attempt here was wrong the first time.
const EDGES_TRUNCATED_TETRAHEDRON: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 3], [2, 6], [3, 8], [4, 5], [4, 7], [5, 9], [6, 7],
  [6, 10], [7, 10], [8, 9], [8, 11], [9, 11], [10, 11],
];
const FACES_TRUNCATED_TETRAHEDRON: number[][] = [
  [4, 1, 5], [10, 6, 7], [9, 8, 11], [3, 0, 2],
  [6, 2, 0, 1, 4, 7], [11, 10, 7, 4, 5, 9], [9, 5, 1, 0, 3, 8], [8, 3, 2, 6, 10, 11],
];

// ---------------------------------------------------------------------------
// TRUNCATED OCTAHEDRON — all permutations of (0, +-1, +-2)
// ---------------------------------------------------------------------------

const VERTS_TRUNCATED_OCTAHEDRON: Vec3[] = [
  [-2, -1, 0], [-2, 0, -1], [-2, 0, 1], [-2, 1, 0],
  [-1, -2, 0], [-1, 0, -2], [-1, 0, 2], [-1, 2, 0],
  [0, -2, -1], [0, -2, 1], [0, -1, -2], [0, -1, 2], [0, 1, -2], [0, 1, 2], [0, 2, -1], [0, 2, 1],
  [1, -2, 0], [1, 0, -2], [1, 0, 2], [1, 2, 0],
  [2, -1, 0], [2, 0, -1], [2, 0, 1], [2, 1, 0],
];
const EDGES_TRUNCATED_OCTAHEDRON: [number, number][] = [
  [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 8], [4, 9], [5, 10], [5, 12],
  [6, 11], [6, 13], [7, 14], [7, 15], [8, 10], [8, 16], [9, 11], [9, 16], [10, 17], [11, 18], [12, 14],
  [12, 17], [13, 15], [13, 18], [14, 19], [15, 19], [16, 20], [17, 21], [18, 22], [19, 23], [20, 21],
  [20, 22], [21, 23], [22, 23],
];
const FACES_TRUNCATED_OCTAHEDRON: number[][] = [
  [9, 4, 8, 16], [1, 0, 2, 3], [8, 4, 0, 1, 5, 10], [10, 5, 12, 17], [6, 2, 0, 4, 9, 11], [13, 6, 11, 18],
  [12, 5, 1, 3, 7, 14], [20, 16, 8, 10, 17, 21], [7, 3, 2, 6, 13, 15], [14, 7, 15, 19],
  [21, 17, 12, 14, 19, 23], [18, 11, 9, 16, 20, 22], [19, 15, 13, 18, 22, 23], [22, 20, 21, 23],
];

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

export const ARCHIMEDEAN_ADDITIONS: Record<string, PolyhedronSpec> = {
  CUBOCTAHEDRON: makeSpec(
    'CUBOCTAHEDRON',
    'cuboctahedron',
    14,
    VERTS_CUBOCTAHEDRON,
    EDGES_CUBOCTAHEDRON,
    FACES_CUBOCTAHEDRON,
  ),
  TRUNCATED_TETRAHEDRON: makeSpec(
    'TRUNCATED_TETRAHEDRON',
    'truncated_tetrahedron',
    8,
    VERTS_TRUNCATED_TETRAHEDRON,
    EDGES_TRUNCATED_TETRAHEDRON,
    FACES_TRUNCATED_TETRAHEDRON,
  ),
  TRUNCATED_OCTAHEDRON: makeSpec(
    'TRUNCATED_OCTAHEDRON',
    'truncated_octahedron',
    14,
    VERTS_TRUNCATED_OCTAHEDRON,
    EDGES_TRUNCATED_OCTAHEDRON,
    FACES_TRUNCATED_OCTAHEDRON,
  ),
};

export const ARCHIMEDEAN_ADDITION_IDS = Object.keys(ARCHIMEDEAN_ADDITIONS);
