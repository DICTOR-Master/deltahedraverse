/**
 * catalan.ts — Catalan solids: the exact face/vertex duals of the 13
 * Archimedean solids (already in ./archimedean.ts, verified). A genuinely
 * different category from every other family in this registry, not a
 * missing entry among Platonic/Archimedean/Johnson (Zalgaller proved in
 * 1969 that those three plus deltahedra plus prisms/antiprisms are the
 * complete classification of convex REGULAR-faced polyhedra): Catalan
 * solids are face-transitive, not vertex-transitive, with congruent but
 * IRREGULAR faces — see docs/catalan-solids-spec.md for the full design
 * record this file implements.
 *
 * Two load-bearing assumptions every other family in this registry
 * relies on break here, and both needed a genuine architectural answer,
 * not a special case:
 *   - `makeSpec`'s "normalize to one uniform unit edge" doesn't apply —
 *     11 of the 13 have 2-3 distinct edge lengths per face. Use
 *     `makeSpecByCircumradius` instead (normalize to circumradius = 1,
 *     computed per shape), decided empirically over 3 rejected
 *     alternatives — see the spec doc's "Normalization convention,
 *     decided" section.
 *   - face-attach's discrete registration count, previously assumed
 *     equal to a face's own vertex count (only true for a regular
 *     n-gon), needs `faceRotationalSymmetry` instead — computed from
 *     the face's own edge-length AND interior-angle sequence, not
 *     assumed. Reduces to the old behavior for every regular-faced
 *     shape already in this registry (checked against all of them
 *     before trusting it for anything new).
 *
 * Construction method: polar reciprocation about the dual Archimedean
 * solid's own midsphere (`v' = c * r_mid^2 / |c|^2` for each Archimedean
 * face centroid `c`) — no independent golden-ratio/trig coordinate
 * derivation needed, the same "derive from an already-verified shape"
 * principle as TRUNCATED_ICOSAHEDRON (archimedean.ts) and J6
 * (johnson.ts). Faces come from a real `scipy.spatial.ConvexHull` on the
 * reciprocated points (batches 4+'s method), then verified beyond the
 * usual Euler/edge checks with two properties specific to this family:
 * every face's own edge-length signature matches every OTHER face's
 * (true congruence, not just internal consistency), and every face sits
 * at the same distance from center (a uniform insphere radius — the
 * actual defining property of face-transitivity, not assumed from the
 * construction method alone).
 *
 * This batch: rhombic dodecahedron and rhombic triacontahedron, the 2 of
 * 13 with uniform edge length (a rhombus's 4 sides are equal by
 * definition) — the lowest-risk starting point, needing only the
 * face-attach registration generalization and not yet exercising the
 * non-uniform-edge case the other 11 will need.
 */

import { type Vec3, type PolyhedronSpec, makeSpecByCircumradius } from './core';

// ---------------------------------------------------------------------------
// RHOMBIC_DODECAHEDRON — dual of CUBOCTAHEDRON
// ---------------------------------------------------------------------------

const VERTS_RHOMBIC_DODECAHEDRON: Vec3[] = [
  [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5],
  [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5],
  [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [-1.0, 0.0, 1.4953261511274047e-17],
  [1.4953261511274047e-17, -1.0, 1.4953261511274047e-17], [1.4953261511274047e-17, 0.0, -1.0], [1.0, 0.0, 1.4953261511274047e-17],
  [1.4953261511274047e-17, 1.0, 1.4953261511274047e-17], [1.4953261511274047e-17, 0.0, 1.0],
];
const EDGES_RHOMBIC_DODECAHEDRON: [number, number][] = [
  [0, 8], [0, 10], [0, 12], [1, 8], [1, 9], [1, 10], [2, 8], [2, 9], [2, 13], [3, 9], [3, 10], [3, 11], [4, 10], [4, 11], [4, 12], [5, 9], [5, 11], [5, 13], [6, 8], [6, 12], [6, 13], [7, 11], [7, 12], [7, 13],
];
// Already consistent (each face's vertex 0 is its acute corner) as
// produced by the hull-merge angle sort -- verified by
// scripts/_regen_faces.ts, not assumed (RHOMBIC_TRIACONTAHEDRON below
// was NOT this lucky, see its comment).
const FACES_RHOMBIC_DODECAHEDRON: number[][] = [
  [10, 3, 9, 1], [9, 2, 8, 1], [11, 5, 9, 3], [9, 5, 13, 2], [11, 3, 10, 4], [10, 1, 8, 0], [12, 4, 10, 0], [11, 7, 13, 5], [11, 4, 12, 7], [13, 6, 8, 2], [12, 0, 8, 6], [13, 7, 12, 6],
];

// ---------------------------------------------------------------------------
// RHOMBIC_TRIACONTAHEDRON — dual of ICOSIDODECAHEDRON
// ---------------------------------------------------------------------------

const VERTS_RHOMBIC_TRIACONTAHEDRON: Vec3[] = [
  [-0.8506508083520243, -0.5257311121191581, 1.0015584350098166e-17], [0.3249196962328989, -0.8506508083520545, 9.193976231001003e-18], [-0.525731112119124, -0.525731112119124, -0.525731112119124],
  [-2.0165606074023016e-17, -0.8506508083520243, -0.5257311121191581], [0.525731112119124, -0.525731112119124, -0.525731112119124], [-2.0165606074023016e-17, -0.3249196962328989, -0.8506508083520545],
  [0.8506508083520243, -0.5257311121191581, 1.2166582331327217e-17], [0.5257311121191584, -1.075498990614526e-18, -0.8506508083520246], [-0.5257311121191581, 0.0, -0.8506508083520243],
  [-2.0908757599104567e-17, 0.3249196962328989, -0.8506508083520545], [-2.0165606074023016e-17, -0.8506508083520243, 0.5257311121191581], [-0.3249196962328989, -0.8506508083520545, 1.2166582331327217e-17],
  [-0.525731112119124, -0.525731112119124, 0.525731112119124], [0.525731112119124, -0.525731112119124, 0.525731112119124], [-2.0908757599104567e-17, -0.3249196962328989, 0.8506508083520545],
  [0.5257311121191584, -1.075498990614526e-18, 0.8506508083520246], [-2.0165606074023016e-17, 0.3249196962328989, 0.8506508083520545], [-0.5257311121191581, 0.0, 0.8506508083520243],
  [0.8506508083520545, 0.0, 0.3249196962328989], [0.525731112119124, 0.525731112119124, 0.525731112119124], [0.8506508083520243, 0.5257311121191581, 1.2166582331327217e-17],
  [0.8506508083520545, -1.4863030501631065e-18, -0.3249196962328989], [-0.8506508083520545, 0.0, -0.3249196962328989], [-0.525731112119124, 0.525731112119124, -0.525731112119124],
  [-0.3249196962328989, 0.8506508083520545, 1.2166582331327217e-17], [-2.0165606074023016e-17, 0.8506508083520243, 0.5257311121191581], [0.3249196962328989, 0.8506508083520545, 9.193976231001003e-18],
  [0.525731112119124, 0.525731112119124, -0.525731112119124], [-2.0165606074023016e-17, 0.8506508083520243, -0.5257311121191581], [-0.8506508083520545, -1.4863030501631065e-18, 0.3249196962328989],
  [-0.525731112119124, 0.525731112119124, 0.525731112119124], [-0.8506508083520243, 0.5257311121191581, 1.0015584350098166e-17],
];
const EDGES_RHOMBIC_TRIACONTAHEDRON: [number, number][] = [
  [0, 2], [0, 11], [0, 12], [0, 22], [0, 29], [1, 3], [1, 6], [1, 10], [2, 3], [2, 8], [3, 4], [3, 5], [3, 11], [4, 6], [4, 7], [5, 7], [5, 8], [6, 13], [6, 18], [6, 21], [7, 9], [7, 21], [7, 27], [8, 9], [8, 22], [8, 23], [9, 28], [10, 11], [10, 12], [10, 13], [10, 14], [12, 17], [13, 15], [14, 15], [14, 17], [15, 16], [15, 18], [15, 19], [16, 17], [16, 25], [17, 29], [17, 30], [18, 20], [19, 20], [19, 25], [20, 21], [20, 26], [20, 27], [22, 31], [23, 28], [23, 31], [24, 25], [24, 28], [24, 31], [25, 26], [25, 30], [26, 28], [27, 28], [29, 31], [30, 31],
];
// Each face's vertex list starts at its acute corner (canonicalized by
// scripts/_regen_faces.ts) so that "vertex 0" always plays the same
// geometric role across faces — see the "Face-attach compatibility
// needs a genuine congruence check" section of the spec doc for why an
// inconsistent starting vertex (a byproduct of the hull-merge angle
// sort, harmless for regular n-gons) broke self-attach here.
const FACES_RHOMBIC_TRIACONTAHEDRON: number[][] = [
  [6, 18, 15, 13], [20, 19, 15, 18], [6, 13, 10, 1], [15, 14, 10, 13], [6, 1, 3, 4], [10, 14, 17, 12], [6, 4, 7, 21], [20, 21, 7, 27], [20, 18, 6, 21], [15, 19, 25, 16], [20, 26, 25, 19], [28, 23, 31, 24], [7, 4, 3, 5], [10, 12, 0, 11], [3, 11, 0, 2], [10, 11, 3, 1], [8, 2, 0, 22], [8, 22, 31, 23], [28, 9, 8, 23], [25, 30, 17, 16], [15, 16, 17, 14], [17, 29, 0, 12], [25, 24, 31, 30], [17, 30, 31, 29], [31, 22, 0, 29], [7, 9, 28, 27], [20, 27, 28, 26], [28, 24, 25, 26], [3, 2, 8, 5], [7, 5, 8, 9],
];

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

export const CATALAN_ADDITIONS: Record<string, PolyhedronSpec> = {
  RHOMBIC_DODECAHEDRON: makeSpecByCircumradius(
    'RHOMBIC_DODECAHEDRON',
    'rhombic_dodecahedron',
    12,
    VERTS_RHOMBIC_DODECAHEDRON,
    EDGES_RHOMBIC_DODECAHEDRON,
    FACES_RHOMBIC_DODECAHEDRON,
  ),
  RHOMBIC_TRIACONTAHEDRON: makeSpecByCircumradius(
    'RHOMBIC_TRIACONTAHEDRON',
    'rhombic_triacontahedron',
    30,
    VERTS_RHOMBIC_TRIACONTAHEDRON,
    EDGES_RHOMBIC_TRIACONTAHEDRON,
    FACES_RHOMBIC_TRIACONTAHEDRON,
  ),
};

export const CATALAN_ADDITION_IDS = Object.keys(CATALAN_ADDITIONS);
