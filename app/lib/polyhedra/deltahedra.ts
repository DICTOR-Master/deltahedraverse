/**
 * deltahedra.ts — the 8 convex deltahedra (D4, D6, D8, D10, D12, D14, D16,
 * D20), unit edge length, each centered at its own centroid. Vertex/edge/face
 * data was derived from first principles and cross-checked against a 3D
 * convex-hull computation (vertex count, edge count, face count, and
 * vertex-degree sequence all match the known values for every shape).
 *
 * D12 (snub disphenoid) is the one shape that is not compass-and-straightedge
 * constructible — its coordinates depend on the positive real root of an
 * irreducible cubic, hardcoded below rather than solved at runtime.
 *
 * Call validateShape() (from ./core) in a test to re-check edge/face
 * uniformity at any time.
 */

import { type Vec3, type PolyhedronSpec, makeSpec } from './core';

// ---------------------------------------------------------------------------
// D4 — tetrahedron
// ---------------------------------------------------------------------------

function rawD4(): Vec3[] {
  const s3 = Math.sqrt(3);
  return [
    [1 / s3, 0, 0],
    [-1 / (2 * s3), 0.5, 0],
    [-1 / (2 * s3), -0.5, 0],
    [0, 0, Math.sqrt(2 / 3)],
  ];
}
const EDGES_D4: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const FACES_D4: number[][] = [[2, 1, 0], [3, 0, 1], [3, 1, 2], [3, 2, 0]];

// ---------------------------------------------------------------------------
// D6 — triangular bipyramid
// ---------------------------------------------------------------------------

function rawD6(): Vec3[] {
  const s3 = Math.sqrt(3);
  return [
    [1, 0, 0],
    [-0.5, s3 / 2, 0],
    [-0.5, -s3 / 2, 0],
    [0, 0, Math.SQRT2],
    [0, 0, -Math.SQRT2],
  ];
}
const EDGES_D6: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4]];
const FACES_D6: number[][] = [[3, 0, 1], [3, 1, 2], [3, 2, 0], [4, 1, 0], [4, 2, 1], [4, 0, 2]];

// ---------------------------------------------------------------------------
// D8 — octahedron
// ---------------------------------------------------------------------------

function rawD8(): Vec3[] {
  return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
}
const EDGES_D8: [number, number][] = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
const FACES_D8: number[][] = [[4, 2, 1], [4, 0, 2], [3, 4, 1], [3, 0, 4], [5, 1, 2], [5, 2, 0], [5, 3, 1], [5, 0, 3]];

// ---------------------------------------------------------------------------
// D10 — pentagonal bipyramid
// ---------------------------------------------------------------------------

function rawD10(): Vec3[] {
  const pent: Vec3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (2 * Math.PI * k) / 5;
    pent.push([Math.cos(a), Math.sin(a), 0]);
  }
  const s = 2 * Math.sin(Math.PI / 5); // edge length at circumradius 1
  const h = Math.sqrt(s * s - 1); // apex height that makes the triangles equilateral
  return [...pent, [0, 0, h], [0, 0, -h]];
}
const EDGES_D10: [number, number][] = [[0, 1], [0, 4], [0, 5], [0, 6], [1, 2], [1, 5], [1, 6], [2, 3], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6], [4, 5], [4, 6]];
const FACES_D10: number[][] = [[5, 0, 1], [2, 3, 5], [2, 5, 1], [6, 1, 0], [6, 3, 2], [6, 2, 1], [4, 3, 6], [4, 6, 0], [4, 5, 3], [4, 0, 5]];

// ---------------------------------------------------------------------------
// D12 — snub disphenoid (the non-constructible one)
// ---------------------------------------------------------------------------

// Positive real root of 2q^3 + 11q^2 + 4q - 1 = 0 (verified to 25 digits via
// mpmath; double-precision-truncated here since it only feeds Math.sqrt calls).
const Q_D12 = 0.16902222942417583;

function rawD12(): Vec3[] {
  const q = Q_D12;
  const r = Math.sqrt(q);
  const s = Math.sqrt((1 - q) / (2 * q));
  const t = Math.sqrt(2 - 2 * q);
  return [
    [t, r, 0], [-t, r, 0],
    [0, -r, t], [0, -r, -t],
    [1, -s, 0], [-1, -s, 0],
    [0, s, 1], [0, s, -1],
  ];
}
const EDGES_D12: [number, number][] = [[0, 2], [0, 3], [0, 4], [0, 6], [0, 7], [1, 2], [1, 3], [1, 5], [1, 6], [1, 7], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 7], [4, 5], [6, 7]];
const FACES_D12: number[][] = [[2, 1, 5], [6, 1, 2], [6, 2, 0], [3, 5, 1], [4, 3, 0], [4, 5, 3], [4, 0, 2], [4, 2, 5], [7, 6, 0], [7, 0, 3], [7, 1, 6], [7, 3, 1]];

// ---------------------------------------------------------------------------
// D14 — triaugmented triangular prism
// ---------------------------------------------------------------------------

/** Apex of a unit, equilateral-triangle-faced pyramid erected outward on square P-Q-Qp-Pp. */
function squareApex(P: Vec3, Q: Vec3, Pp: Vec3, Qp: Vec3): Vec3 {
  const c: Vec3 = [
    (P[0] + Q[0] + Pp[0] + Qp[0]) / 4,
    (P[1] + Q[1] + Pp[1] + Qp[1]) / 4,
    (P[2] + Q[2] + Pp[2] + Qp[2]) / 4,
  ];
  let ex = Q[0] - P[0];
  let ey = Q[1] - P[1];
  const elen = Math.hypot(ex, ey);
  ex /= elen; ey /= elen;
  let nx = -ey;
  let ny = ex; // horizontal normal candidate, perpendicular to edge P-Q
  if (nx * c[0] + ny * c[1] < 0) { nx = -nx; ny = -ny; } // point away from the prism's central axis
  const hp = 1 / Math.SQRT2; // pyramid height for a unit-edge square base with equilateral sides
  return [c[0] + hp * nx, c[1] + hp * ny, c[2]];
}

function rawD14(): Vec3[] {
  const r3 = Math.sqrt(3);
  const A: Vec3 = [1 / r3, 0, 0];
  const B: Vec3 = [-1 / (2 * r3), 0.5, 0];
  const C: Vec3 = [-1 / (2 * r3), -0.5, 0];
  const Ap: Vec3 = [A[0], A[1], A[2] + 1]; // prism height 1 so the side faces start as unit squares
  const Bp: Vec3 = [B[0], B[1], B[2] + 1];
  const Cp: Vec3 = [C[0], C[1], C[2] + 1];
  const apexAB = squareApex(A, B, Ap, Bp);
  const apexBC = squareApex(B, C, Bp, Cp);
  const apexCA = squareApex(C, A, Cp, Ap);
  return [A, B, C, Ap, Bp, Cp, apexAB, apexBC, apexCA];
}
const EDGES_D14: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 6], [0, 8], [1, 2], [1, 4], [1, 6], [1, 7], [2, 5], [2, 7], [2, 8], [3, 4], [3, 5], [3, 6], [3, 8], [4, 5], [4, 6], [4, 7], [5, 7], [5, 8]];
const FACES_D14: number[][] = [[0, 3, 8], [5, 8, 3], [6, 3, 0], [6, 0, 1], [2, 7, 1], [2, 5, 7], [2, 8, 5], [2, 0, 8], [2, 1, 0], [4, 7, 5], [4, 5, 3], [4, 3, 6], [4, 1, 7], [4, 6, 1]];
// vertices 0-5 = the two prism triangles (degree 5 each); 6,7,8 = the three augmentation apexes (degree 4 each)

// ---------------------------------------------------------------------------
// D16 — gyroelongated square bipyramid
// ---------------------------------------------------------------------------

function rawD16(): Vec3[] {
  const R = 1 / Math.SQRT2; // circumradius of the top/bottom squares
  const H = R * Math.sqrt(2 * Math.cos(Math.PI / 4)); // antiprism height forced by unit edge length
  const hp = Math.sqrt(1 - R * R); // pyramid cap height
  const top: Vec3[] = [[0.5, 0.5, H / 2], [-0.5, 0.5, H / 2], [-0.5, -0.5, H / 2], [0.5, -0.5, H / 2]];
  const bot: Vec3[] = [[R, 0, -H / 2], [0, R, -H / 2], [-R, 0, -H / 2], [0, -R, -H / 2]]; // rotated 45° vs. top
  return [...top, ...bot, [0, 0, H / 2 + hp], [0, 0, -H / 2 - hp]];
}
const EDGES_D16: [number, number][] = [[0, 1], [0, 3], [0, 4], [0, 5], [0, 8], [1, 2], [1, 5], [1, 6], [1, 8], [2, 3], [2, 6], [2, 7], [2, 8], [3, 4], [3, 7], [3, 8], [4, 5], [4, 7], [4, 9], [5, 6], [5, 9], [6, 7], [6, 9], [7, 9]];
const FACES_D16: number[][] = [[9, 6, 5], [9, 5, 4], [7, 6, 9], [7, 9, 4], [1, 5, 6], [0, 4, 5], [0, 5, 1], [0, 1, 8], [2, 6, 7], [2, 1, 6], [2, 8, 1], [3, 7, 4], [3, 4, 0], [3, 0, 8], [3, 8, 2], [3, 2, 7]];
// vertices 0-7 = the antiprism ring (degree 5 each); 8,9 = the two pyramid apexes (degree 4 each)

// ---------------------------------------------------------------------------
// D20 — icosahedron
// ---------------------------------------------------------------------------

function rawD20(): Vec3[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: Vec3[] = [];
  for (const a of [1, -1]) {
    for (const b of [phi, -phi]) {
      verts.push([0, a, b]);
      verts.push([a, b, 0]);
      verts.push([b, 0, a]);
    }
  }
  return verts;
}
const EDGES_D20: [number, number][] = [[0, 1], [0, 2], [0, 5], [0, 6], [0, 7], [1, 2], [1, 3], [1, 7], [1, 8], [2, 4], [2, 6], [2, 8], [3, 7], [3, 8], [3, 9], [3, 11], [4, 6], [4, 8], [4, 9], [4, 10], [5, 6], [5, 7], [5, 10], [5, 11], [6, 10], [7, 11], [8, 9], [9, 10], [9, 11], [10, 11]];
const FACES_D20: number[][] = [[0, 7, 5], [1, 3, 7], [1, 0, 2], [1, 7, 0], [11, 5, 7], [11, 7, 3], [6, 0, 5], [6, 2, 0], [6, 4, 2], [8, 3, 1], [8, 2, 4], [8, 1, 2], [9, 11, 3], [9, 3, 8], [9, 8, 4], [10, 9, 4], [10, 11, 9], [10, 5, 11], [10, 6, 5], [10, 4, 6]];

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

export const DELTAHEDRA: Record<string, PolyhedronSpec> = {
  D4: makeSpec('D4', 'tetrahedron', 4, rawD4(), EDGES_D4, FACES_D4),
  D6: makeSpec('D6', 'triangular_bipyramid', 6, rawD6(), EDGES_D6, FACES_D6),
  D8: makeSpec('D8', 'octahedron', 8, rawD8(), EDGES_D8, FACES_D8),
  D10: makeSpec('D10', 'pentagonal_bipyramid', 10, rawD10(), EDGES_D10, FACES_D10),
  D12: makeSpec('D12', 'snub_disphenoid', 12, rawD12(), EDGES_D12, FACES_D12),
  D14: makeSpec('D14', 'triaugmented_triangular_prism', 14, rawD14(), EDGES_D14, FACES_D14),
  D16: makeSpec('D16', 'gyroelongated_square_bipyramid', 16, rawD16(), EDGES_D16, FACES_D16),
  D20: makeSpec('D20', 'icosahedron', 20, rawD20(), EDGES_D20, FACES_D20),
};

export const DELTAHEDRON_IDS = Object.keys(DELTAHEDRA);

// Usage in a test file:
//   for (const id of DELTAHEDRON_IDS) {
//     const problems = validateShape(DELTAHEDRA[id]);
//     expect(problems).toEqual([]);
//   }
