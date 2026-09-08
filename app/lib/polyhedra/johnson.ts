/**
 * johnson.ts — a first batch of 6 Johnson solids: the two simple pyramids
 * (square, pentagonal) and the three cupolas (triangular, square,
 * pentagonal), plus the pentagonal rotunda.
 *
 * 92 Johnson solids exist in total (any strictly-convex, regular-faced
 * polyhedron that isn't already Platonic, Archimedean, a prism, or an
 * antiprism). 5 of the 92 are already in this registry as deltahedra —
 * J12 (triangular bipyramid = D6), J13 (pentagonal bipyramid = D10), J17
 * (gyroelongated square bipyramid = D16), J51 (triaugmented triangular
 * prism = D14), and J84 (snub disphenoid = D12) — not re-derived here,
 * same principle as platonic.ts not re-deriving D4/D8/D20. That leaves 87
 * new to add; this batch covers the 6 simplest, all with genuinely
 * closed-form coordinates (no numerical root-finding needed) rather than
 * the composite augmented/diminished/gyrate solids that make up most of
 * the family and are deliberately left for follow-up batches.
 *
 * **Pyramids (J1, J2)**: a regular n-gon base (unit edge, circumradius
 * R_n = 1/(2*sin(pi/n))) capped with a single apex directly above the
 * center. Every lateral face must be an equilateral triangle, so the
 * apex height solves R_n^2 + h^2 = 1 (the lateral edge is the hypotenuse
 * of base-radius and height) -- h = sqrt(1 - R_n^2), which only has a
 * real solution for R_n < 1, i.e. n = 4 or 5 (n = 3 would give a regular
 * tetrahedron, already Platonic and excluded from the Johnson list by
 * definition; n >= 6 has R_n >= 1, no valid apex exists).
 *
 * **Cupolas (J3, J4, J5)**: a smaller top n-gon (circumradius R_n) sits
 * at height h above a larger bottom 2n-gon (circumradius R_2n), joined
 * by n alternating squares and triangles around the side. Top vertex j
 * sits angularly centered above bottom edge (2j, 2j+1) -- offset by
 * pi/(2n) from bottom vertex 2j -- so requiring the lateral edge
 * |T_j - B_2j| = 1 gives a single closed-form equation for h (law of
 * cosines in the vertical triangle formed by the two radii and the
 * angular offset): h^2 = 1 - R_n^2 - R_2n^2 + 2*R_n*R_2n*cos(pi/(2n)).
 * Top-top and bottom-bottom edges are already unit length by construction
 * (R_n and R_2n are each exactly the circumradius for a unit-edge n-gon),
 * so this one equation is everything h needs to satisfy.
 *
 * **Pentagonal rotunda (J6)**: not built from a height formula at all --
 * derived directly from this registry's own ICOSIDODECAHEDRON
 * (archimedean.ts), which turns out to have exactly the right structure:
 * projecting its 30 vertices onto a 5-fold axis (through a pentagon
 * face's centroid) splits them into 4 bands of 5/5/10/5/5, with the
 * middle 10 exactly coplanar (a regular decagon "equator"). Taking the
 * closed half (10 equatorial + 5 + 5 = 20 vertices, matching J6's known
 * vertex count exactly) and re-hulling turns that flat cross-section
 * into a real decagon face automatically -- the pentagonal rotunda is
 * genuinely half of an icosidodecahedron, not a coincidental resemblance,
 * and deriving it this way avoids re-deriving golden-ratio coordinates
 * from scratch (same "derive from an already-verified shape" principle
 * as TRUNCATED_ICOSAHEDRON in archimedean.ts).
 *
 * Every shape here (however derived) was still cross-checked the same
 * way as the rest of this registry: a real scipy.spatial.ConvexHull
 * computation, edge-length uniformity, and vertex/edge/face counts
 * against each solid's known values -- not trusted from the formula
 * derivation alone. All 6 matched on the first attempt (no transcription
 * bugs this batch), but the derivation was still verified rather than
 * assumed, per this project's own standard.
 */

import { type Vec3, type PolyhedronSpec, makeSpec } from './core';

// ---------------------------------------------------------------------------
// J1 — square pyramid
// ---------------------------------------------------------------------------

const VERTS_J1_SQUARE_PYRAMID: Vec3[] = [
  [0.7071067811865476, 0, 0], [4.329780281177467e-17, 0.7071067811865476, 0], [-0.7071067811865476, 8.659560562354934e-17, 0],
  [-1.29893408435324e-16, -0.7071067811865476, 0], [0, 0, 0.7071067811865475],
];
const EDGES_J1_SQUARE_PYRAMID: [number, number][] = [
  [0, 1], [0, 3], [0, 4], [1, 2], [1, 4], [2, 3], [2, 4], [3, 4],
];
const FACES_J1_SQUARE_PYRAMID: number[][] = [
  [3, 4, 2], [3, 0, 4], [2, 4, 1], [4, 0, 1], [2, 1, 0, 3],
];

// ---------------------------------------------------------------------------
// J2 — pentagonal pyramid
// ---------------------------------------------------------------------------

const VERTS_J2_PENTAGONAL_PYRAMID: Vec3[] = [
  [0.8506508083520399, 0, 0], [0.2628655560595668, 0.8090169943749473, 0], [-0.6881909602355867, 0.5000000000000001, 0],
  [-0.6881909602355868, -0.4999999999999999, 0], [0.26286555605956663, -0.8090169943749475, 0], [0, 0, 0.5257311121191337],
];
const EDGES_J2_PENTAGONAL_PYRAMID: [number, number][] = [
  [0, 1], [0, 4], [0, 5], [1, 2], [1, 5], [2, 3], [2, 5], [3, 4], [3, 5], [4, 5],
];
const FACES_J2_PENTAGONAL_PYRAMID: number[][] = [
  [5, 0, 1], [3, 4, 5], [4, 0, 5], [3, 5, 2], [5, 1, 2], [2, 1, 0, 4, 3],
];

// ---------------------------------------------------------------------------
// J3 — triangular cupola
// ---------------------------------------------------------------------------

const VERTS_J3_TRIANGULAR_CUPOLA: Vec3[] = [
  [1.0000000000000002, 0, 0], [0.5000000000000002, 0.8660254037844388, 0], [-0.4999999999999999, 0.8660254037844389, 0],
  [-1.0000000000000002, 1.2246467991473535e-16, 0], [-0.5000000000000006, -0.8660254037844386, 0], [0.5000000000000002, -0.8660254037844388, 0],
  [0.5000000000000001, 0.28867513459481287, 0.8164965809277259], [-0.5000000000000001, 0.28867513459481287, 0.8164965809277259], [-1.0605752387249069e-16, -0.5773502691896258, 0.8164965809277259],
];
const EDGES_J3_TRIANGULAR_CUPOLA: [number, number][] = [
  [0, 1], [0, 5], [0, 6], [1, 2], [1, 6], [2, 3], [2, 7], [3, 4], [3, 7], [4, 5], [4, 8], [5, 8],
  [6, 7], [6, 8], [7, 8],
];
const FACES_J3_TRIANGULAR_CUPOLA: number[][] = [
  [6, 0, 1], [4, 5, 8], [8, 6, 7], [7, 2, 3], [5, 0, 6, 8], [3, 2, 1, 0, 5, 4], [3, 4, 8, 7],
  [7, 6, 1, 2],
];

// ---------------------------------------------------------------------------
// J4 — square cupola
// ---------------------------------------------------------------------------

const VERTS_J4_SQUARE_CUPOLA: Vec3[] = [
  [1.3065629648763766, 0, 0], [0.9238795325112868, 0.9238795325112867, 0], [8.000390764101651e-17, 1.3065629648763766, 0],
  [-0.9238795325112867, 0.9238795325112868, 0], [-1.3065629648763766, 1.6000781528203302e-16, 0], [-0.923879532511287, -0.9238795325112867, 0],
  [-2.400117229230495e-16, -1.3065629648763766, 0], [0.9238795325112865, -0.923879532511287, 0], [0.6532814824381883, 0.2705980500730985, 0.7071067811865474],
  [-0.2705980500730985, 0.6532814824381883, 0.7071067811865474], [-0.6532814824381884, -0.27059805007309845, 0.7071067811865474], [0.2705980500730987, -0.6532814824381882, 0.7071067811865474],
];
const EDGES_J4_SQUARE_CUPOLA: [number, number][] = [
  [0, 1], [0, 7], [0, 8], [1, 2], [1, 8], [2, 3], [2, 9], [3, 4], [3, 9], [4, 5], [4, 10], [5, 6],
  [5, 10], [6, 7], [6, 11], [7, 11], [8, 9], [8, 11], [9, 10], [10, 11],
];
const FACES_J4_SQUARE_CUPOLA: number[][] = [
  [8, 0, 1], [5, 10, 4], [6, 7, 11], [9, 2, 3], [4, 3, 2, 1, 0, 7, 6, 5], [5, 6, 11, 10],
  [11, 7, 0, 8], [10, 11, 8, 9], [9, 8, 1, 2], [4, 10, 9, 3],
];

// ---------------------------------------------------------------------------
// J5 — pentagonal cupola
// ---------------------------------------------------------------------------

const VERTS_J5_PENTAGONAL_CUPOLA: Vec3[] = [
  [1.618033988749895, 0, 0], [1.3090169943749475, 0.9510565162951536, 0], [0.5000000000000001, 1.5388417685876268, 0],
  [-0.4999999999999999, 1.5388417685876268, 0], [-1.3090169943749472, 0.9510565162951538, 0], [-1.618033988749895, 1.9815201452341832e-16, 0],
  [-1.3090169943749477, -0.9510565162951534, 0], [-0.5000000000000002, -1.5388417685876268, 0], [0.4999999999999997, -1.5388417685876268, 0],
  [1.3090169943749472, -0.951056516295154, 0], [0.8090169943749473, 0.26286555605956674, 0.5257311121191338], [5.208733948202171e-17, 0.8506508083520399, 0.5257311121191338],
  [-0.8090169943749473, 0.26286555605956685, 0.5257311121191338], [-0.5000000000000001, -0.6881909602355867, 0.5257311121191338], [0.4999999999999998, -0.6881909602355868, 0.5257311121191338],
];
const EDGES_J5_PENTAGONAL_CUPOLA: [number, number][] = [
  [0, 1], [0, 9], [0, 10], [1, 2], [1, 10], [2, 3], [2, 11], [3, 4], [3, 11], [4, 5], [4, 12], [5, 6],
  [5, 12], [6, 7], [6, 13], [7, 8], [7, 13], [8, 9], [8, 14], [9, 14], [10, 11], [10, 14], [11, 12], [12, 13],
  [13, 14],
];
const FACES_J5_PENTAGONAL_CUPOLA: number[][] = [
  [10, 0, 1], [7, 13, 6], [11, 2, 3], [5, 12, 4], [8, 9, 14], [11, 10, 1, 2], [6, 13, 12, 5],
  [13, 14, 10, 11, 12], [14, 9, 0, 10], [12, 11, 3, 4], [5, 4, 3, 2, 1, 0, 9, 8, 7, 6],
  [7, 8, 14, 13],
];

// ---------------------------------------------------------------------------
// J6 — pentagonal rotunda (half of ICOSIDODECAHEDRON — see header comment)
// ---------------------------------------------------------------------------

const VERTS_J6_PENTAGONAL_ROTUNDA: Vec3[] = [
  [-0.309016994375, -0.5, 0.809016994375], [-0.809016994375, -0.309016994375, -0.5], [-0.809016994375, -0.309016994375, 0.5],
  [0, 0, -1], [0, 0, 1], [-0.5, 0.809016994375, -0.309016994375],
  [0.5, -0.809016994375, -0.309016994375], [-0.309016994375, 0.5, -0.809016994375], [0, -1, 0],
  [-0.309016994375, 0.5, 0.809016994375], [0.5, -0.809016994375, 0.309016994375], [-0.5, 0.809016994375, 0.309016994375],
  [-0.5, -0.809016994375, -0.309016994375], [0.309016994375, -0.5, 0.809016994375], [0.309016994375, -0.5, -0.809016994375],
  [-0.809016994375, 0.309016994375, -0.5], [-0.309016994375, -0.5, -0.809016994375], [-1, 0, 0],
  [-0.809016994375, 0.309016994375, 0.5], [-0.5, -0.809016994375, 0.309016994375],
];
const EDGES_J6_PENTAGONAL_ROTUNDA: [number, number][] = [
  [0, 2], [0, 4], [0, 13], [0, 19], [1, 12], [1, 15], [1, 16], [1, 17], [2, 17], [2, 18], [2, 19], [3, 7],
  [3, 14], [3, 16], [4, 9], [4, 13], [5, 7], [5, 11], [5, 15], [6, 8], [6, 10], [6, 14], [7, 15], [8, 10],
  [8, 12], [8, 19], [9, 11], [9, 18], [10, 13], [11, 18], [12, 16], [12, 19], [14, 16], [15, 17], [17, 18],
];
const FACES_J6_PENTAGONAL_ROTUNDA: number[][] = [
  [17, 15, 1], [1, 16, 12], [18, 11, 5, 15, 17], [11, 9, 4, 13, 10, 6, 14, 3, 7, 5],
  [18, 9, 11], [3, 14, 16], [5, 7, 15], [15, 7, 3, 16, 1], [2, 0, 4, 9, 18], [6, 10, 8],
  [19, 8, 10, 13, 0], [12, 8, 19], [16, 14, 6, 8, 12], [0, 13, 4], [2, 18, 17], [19, 0, 2],
  [1, 12, 19, 2, 17],
];

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

export const JOHNSON_ADDITIONS: Record<string, PolyhedronSpec> = {
  J1_SQUARE_PYRAMID: makeSpec(
    'J1_SQUARE_PYRAMID',
    'square_pyramid',
    5,
    VERTS_J1_SQUARE_PYRAMID,
    EDGES_J1_SQUARE_PYRAMID,
    FACES_J1_SQUARE_PYRAMID,
  ),
  J2_PENTAGONAL_PYRAMID: makeSpec(
    'J2_PENTAGONAL_PYRAMID',
    'pentagonal_pyramid',
    6,
    VERTS_J2_PENTAGONAL_PYRAMID,
    EDGES_J2_PENTAGONAL_PYRAMID,
    FACES_J2_PENTAGONAL_PYRAMID,
  ),
  J3_TRIANGULAR_CUPOLA: makeSpec(
    'J3_TRIANGULAR_CUPOLA',
    'triangular_cupola',
    8,
    VERTS_J3_TRIANGULAR_CUPOLA,
    EDGES_J3_TRIANGULAR_CUPOLA,
    FACES_J3_TRIANGULAR_CUPOLA,
  ),
  J4_SQUARE_CUPOLA: makeSpec(
    'J4_SQUARE_CUPOLA',
    'square_cupola',
    10,
    VERTS_J4_SQUARE_CUPOLA,
    EDGES_J4_SQUARE_CUPOLA,
    FACES_J4_SQUARE_CUPOLA,
  ),
  J5_PENTAGONAL_CUPOLA: makeSpec(
    'J5_PENTAGONAL_CUPOLA',
    'pentagonal_cupola',
    12,
    VERTS_J5_PENTAGONAL_CUPOLA,
    EDGES_J5_PENTAGONAL_CUPOLA,
    FACES_J5_PENTAGONAL_CUPOLA,
  ),
  J6_PENTAGONAL_ROTUNDA: makeSpec(
    'J6_PENTAGONAL_ROTUNDA',
    'pentagonal_rotunda',
    17,
    VERTS_J6_PENTAGONAL_ROTUNDA,
    EDGES_J6_PENTAGONAL_ROTUNDA,
    FACES_J6_PENTAGONAL_ROTUNDA,
  ),
};

export const JOHNSON_ADDITION_IDS = Object.keys(JOHNSON_ADDITIONS);
