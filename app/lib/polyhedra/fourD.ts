/**
 * 4D extension, Stage A: classifies which registered 3D shapes can be a
 * "cell" of some convex 4-polytope, purely from their own already-stored
 * geometry (vertices/edges/faces) — never a hand-stored field on the
 * shape itself. Same "derive, don't duplicate" rule core.ts's own file
 * header states for every other derived fact in this registry.
 *
 * The math: a 3D polyhedron closes into a finite solid because the FACE
 * angles meeting at a shared VERTEX sum to less than 360° (the "angle
 * defect" that gives a polyhedron its curvature). The 4D analogue is one
 * dimension up: a 4-polytope closes because the DIHEDRAL angles of its
 * CELLS (3D shapes) meeting at a shared EDGE sum to less than 360° — the
 * natural angle measure at an edge in 3D is the dihedral angle between
 * its two bounding faces, exactly the way the natural angle measure at a
 * vertex in 2D/3D is an interior face angle. `k` copies of a cell meeting
 * at a shared edge need `k * dihedralAngle < 360°` to curve into a real
 * 4D closure; `=360°` tiles ordinary flat 3D space instead (the cube's
 * own case at k=4); `>360°` never closes at all (the icosahedron, at any
 * k — verified below, not assumed).
 */

import type { PolyhedronSpec } from './core';
import { buildFaceConnectors } from './core';
import { POLYHEDRA, POLYHEDRON_IDS } from './index';

const TOL_DEG = 0.05;

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
 * The shape's single dihedral angle in degrees, or `null` if it doesn't
 * have one (most families mix face types and genuinely have several
 * distinct dihedral angles by edge — those are simply not eligible for
 * 4D-cell classification, not given a fabricated average).
 *
 * Sign convention verified against known values: for two faces sharing
 * an edge with outward unit normals n1/n2, the interior dihedral angle
 * is `180° - angleBetween(n1, n2)` — checked directly against a cube
 * (adjacent faces' normals are perpendicular, 90° between them, dihedral
 * 180-90=90°, the known right-angle cube dihedral) and a regular
 * tetrahedron (known dihedral ≈70.53°).
 */
export function dihedralAngleDeg(spec: PolyhedronSpec): number | null {
  const faceConnectors = buildFaceConnectors(spec);
  const angles: number[] = [];
  for (const [i, j] of spec.edges) {
    const sharing = spec.faces
      .map((face, index) => ({ face, index }))
      .filter(({ face }) => faceHasEdge(face, i, j));
    if (sharing.length !== 2) return null; // non-manifold edge -- not a valid closed solid
    const n1 = faceConnectors[sharing[0].index].normal;
    const n2 = faceConnectors[sharing[1].index].normal;
    const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
    const cosPhi = Math.min(1, Math.max(-1, dot));
    const phiDeg = (Math.acos(cosPhi) * 180) / Math.PI;
    angles.push(180 - phiDeg);
  }
  if (angles.length === 0) return null;
  const mean = angles.reduce((s, a) => s + a, 0) / angles.length;
  const maxDev = Math.max(...angles.map((a) => Math.abs(a - mean)));
  if (maxDev > TOL_DEG) return null;
  return mean;
}

export type ClosureKind = '4d' | 'flat-tiles' | 'non-closing';

export interface ClosureOption {
  k: number;
  kind: ClosureKind;
  defectDeg: number;
}

/**
 * Every valid k (>=3 copies meeting at a shared edge) for this shape,
 * each independently classified — a shape can legitimately be more than
 * one kind at different k (the cube is both a tesseract cell at k=3 AND
 * an ordinary flat-space tile at k=4; direct instruction: return every
 * option, never collapse to one default verdict).
 */
export function closureClass(spec: PolyhedronSpec): ClosureOption[] {
  const angle = dihedralAngleDeg(spec);
  if (angle === null) return [];
  const options: ClosureOption[] = [];
  for (let k = 3; k * angle <= 720; k++) {
    const defectDeg = 360 - k * angle;
    let kind: ClosureKind;
    if (defectDeg > TOL_DEG) kind = '4d';
    else if (Math.abs(defectDeg) <= TOL_DEG) kind = 'flat-tiles';
    else kind = 'non-closing';
    options.push({ k, kind, defectDeg });
  }
  return options;
}

/** A shape belongs to the 4D-capable family iff it has at least one real 4D closure option. */
export function is4DCapable(spec: PolyhedronSpec): boolean {
  return closureClass(spec).some((c) => c.kind === '4d');
}

/**
 * Computed, not hand-curated — matches every other family's own id-list
 * pattern in families.ts. Verified against the known, real classification
 * of the six regular convex 4-polytopes in scripts/verify-4d-closure.ts,
 * not just checked for internal consistency.
 */
export const FOURD_CAPABLE_IDS: string[] = POLYHEDRON_IDS.filter((id) => is4DCapable(POLYHEDRA[id]));
