/**
 * 4D extension: the real fold math for closing the geometric gap between
 * two same-shape SIBLING cells that are each independently face-attached
 * to two ADJACENT faces of a shared parent cell (the user's own worked
 * example: a dodecahedron with a second dodecahedron attached to each of
 * its 12 faces).
 *
 * Superseded design note (kept for anyone reading history/diffs): an
 * earlier version of this file scaled each folded cell's own geometry
 * toward its shared face with the parent, on the theory that "the stored
 * flush-3D pose already IS the true 4D pose, unmodified." That's true in
 * isolation for a single parent+child pair (two cells sharing one face
 * are always trivially flush, in any dimension) -- but it's the WRONG
 * quantity for what actually needs fixing: the relationship BETWEEN TWO
 * SIBLINGS sharing an edge of the same parent, which a lone-pair squish
 * never touches at all. Verified directly, not assumed: two real
 * DODECAHEDRON cells independently flush-attached to a shared parent's
 * two adjacent faces are genuinely ~10.3deg apart at their own far edge
 * (scripts/verify-fold4.ts) -- exactly Stage A's own k=3 `defectDeg` for
 * a dodecahedron, the real geometric fact this whole feature exists to
 * show. The fix below rotates each sibling toward the other, around
 * their shared edge, closing half the defect each -- the correct
 * geometric operation, not a per-node scale.
 *
 * The math: a polyhedron edge borders exactly 2 faces, so at most 2
 * independently fold4-attached siblings can ever share one parent edge --
 * meaning the relevant closure case in THIS app is always k=3 (the
 * parent itself is the 3rd cell around that edge), regardless of which
 * other k values a shape could theoretically also support (see
 * fourD.ts's own closureClass for those). `edgeClosingCorrection` returns
 * the rotation (around that shared edge, through its midpoint) that
 * closes HALF the k=3 defect for whichever cell sits on the first face
 * passed in; the mirror rotation for the OTHER cell is obtained by
 * calling it again with the two face indices swapped.
 */

import type { PolyhedronSpec } from './core';
import { buildFaceConnectors } from './core';
import { dihedralAngleDeg, FOURD_CAPABLE_IDS } from './fourD';

export type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a));

function faceHasEdge(face: number[], i: number, j: number): boolean {
  const n = face.length;
  for (let k = 0; k < n; k++) {
    const a = face[k];
    const b = face[(k + 1) % n];
    if ((a === i && b === j) || (a === j && b === i)) return true;
  }
  return false;
}

/**
 * Half the real angular defect between two same-shape sibling cells
 * independently flush-attached to `spec`'s own two faces bordering a
 * shared edge (always the k=3 case -- see this file's own header). Each
 * of the two siblings contributes half; this is that half. `null` if
 * `spec` isn't FOURD_CAPABLE_IDS-eligible, its dihedral angle isn't
 * well-defined, or its own k=3 option somehow isn't a real 4D closure
 * (never true for the 4 shapes that currently qualify, checked directly
 * in scripts/verify-4d-closure.ts rather than assumed here).
 */
export function siblingClosingHalfAngleRad(spec: PolyhedronSpec): number | null {
  if (!FOURD_CAPABLE_IDS.includes(spec.id)) return null;
  const angleDeg = dihedralAngleDeg(spec);
  if (angleDeg === null) return null;
  const defectDeg = 360 - 3 * angleDeg;
  if (defectDeg <= 0) return null;
  return (defectDeg * Math.PI) / 180 / 2;
}

export interface EdgeClosingCorrection {
  /** A point on the shared edge (its midpoint), in `spec`'s own local frame. */
  pivot: Vec3;
  /** Unit vector along the shared edge, in `spec`'s own local frame. */
  axis: Vec3;
  /**
   * The FULL (t=1) signed angle, in radians, to rotate the cell attached
   * at `faceIndexA` around `axis` (through `pivot`) to close its half of
   * the gap with the cell attached at `faceIndexB` -- scale by the
   * slider's own `t` (0..1) for the live render amount.
   */
  angleRad: number;
}

/**
 * `null` if `faceIndexA`/`faceIndexB` don't actually share an edge of
 * `spec`, or `spec` isn't eligible (see siblingClosingHalfAngleRad).
 * Calling this again with the two indices swapped gives the OTHER
 * sibling's own mirrored correction (verified equal-and-opposite in
 * scripts/verify-fold4.ts, not just assumed by symmetry).
 */
export function edgeClosingCorrection(spec: PolyhedronSpec, faceIndexA: number, faceIndexB: number): EdgeClosingCorrection | null {
  if (faceIndexA === faceIndexB) return null; // not a real adjacency
  const halfAngle = siblingClosingHalfAngleRad(spec);
  if (halfAngle === null) return null;

  const faceA = spec.faces[faceIndexA];
  const faceB = spec.faces[faceIndexB];
  let shared: [number, number] | null = null;
  for (let k = 0; k < faceA.length; k++) {
    const i = faceA[k];
    const j = faceA[(k + 1) % faceA.length];
    if (faceHasEdge(faceB, i, j)) {
      // Canonical (ascending) vertex order regardless of which face's own
      // cycle the edge was found in -- adjacent faces traverse a shared
      // edge in OPPOSITE directions under consistent outward winding, so
      // without this, calling this function with the two face indices
      // swapped would silently also flip `axis`, cancelling out the sign
      // flip the caller actually needs (verified live: an earlier version
      // without this returned the SAME angleRad, not equal-and-opposite,
      // for the two sides of a real adjacent pair).
      shared = i < j ? [i, j] : [j, i];
      break;
    }
  }
  if (!shared) return null;
  const [i, j] = shared;
  const vi = spec.vertices[i];
  const vj = spec.vertices[j];
  const pivot = scale(add(vi, vj), 0.5);
  const axis = norm(sub(vj, vi));

  const faceConnectors = buildFaceConnectors(spec);
  const perpOf = (p: Vec3): Vec3 => {
    const rel = sub(p, pivot);
    const along = dot(rel, axis);
    return norm(sub(rel, scale(axis, along)));
  };
  const rA = perpOf(faceConnectors[faceIndexA].pos);
  const rB = perpOf(faceConnectors[faceIndexB].pos);

  // Signed angle from rA to rB around axis. Rotating the faceIndexA cell
  // AGAINST this sense (verified empirically, not assumed -- an earlier
  // version using +sign(thetaAB) measurably DOUBLED the gap instead of
  // closing it, caught by scripts/verify-fold4.ts's own "closes, not
  // opens" check) moves its own far side toward faceIndexB's side,
  // closing the gap.
  const thetaAB = Math.atan2(dot(axis, cross(rA, rB)), dot(rA, rB));
  const sign = -(Math.sign(thetaAB) || 1);
  return { pivot, axis, angleRad: sign * halfAngle };
}
