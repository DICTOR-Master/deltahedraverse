/**
 * 4D extension, Stage C: the actual fold/projection math for a 4D-capable
 * cell face-attached to an identical copy of itself.
 *
 * The stored pose (`AssemblyNode.transform`, computed by ShapeViewer's
 * existing beginFaceAttach) is ALWAYS the ordinary flush-3D pose — this
 * file never changes what gets stored. The fold is a pure, derived,
 * render-time lens: within the true 4D embedding, two cells sharing a
 * face genuinely ARE flush (that's what "4D mode" shows, unmodified).
 * Only when projecting that true 4D relationship down into 3D (dropping
 * the W axis) does the real geometric gap appear, because 4D closure
 * requires curving into a dimension a 3D view can't represent as
 * "touching." See dihedralAngleDeg/closureClass in fourD.ts for the
 * angle this is built from.
 *
 * The relative orientation is a rotation confined to the 2-plane spanned
 * by (the shared face's own outward normal, the new W axis), by angle
 * `Δ = 180° - dihedralAngleDeg(spec)`, pivoting about the shared face's
 * own plane (every point of that face has zero normal-component, so it's
 * exactly fixed — the join itself never moves). Orthogonal projection
 * (drop W) foreshortens the normal-direction component of every OTHER
 * point by a factor of cos(Δ) — never a perspective divide.
 */

import type { PolyhedronSpec } from './core';
import { dihedralAngleDeg, FOURD_CAPABLE_IDS } from './fourD';

export type Vec3 = [number, number, number];

/**
 * The fold angle in radians for a 4D-capable shape's own self-attach, or
 * `null` if the shape isn't 4D-capable at all. Two independent gates:
 * `dihedralAngleDeg` returning null (no single consistent dihedral angle
 * across every edge) AND `FOURD_CAPABLE_IDS` membership (a shape can have
 * a perfectly well-defined single dihedral angle — e.g. the icosahedron,
 * ~138.19° — and still never close into any 4-polytope at any k). This
 * is the sandboxing boundary: gating here, not only in
 * `assembly.ts`'s `isValidAssembly`, means the fold math itself refuses
 * to produce an angle for anything outside the 4 gold-badge shapes,
 * rather than relying solely on the caller to have checked first.
 */
export function foldAngleRad(spec: PolyhedronSpec): number | null {
  if (!FOURD_CAPABLE_IDS.includes(spec.id)) return null;
  const angleDeg = dihedralAngleDeg(spec);
  if (angleDeg === null) return null;
  return ((180 - angleDeg) * Math.PI) / 180;
}

/**
 * The foreshortening scale factor along the fold axis, at fold amount
 * `t` (the slider position: `t=0` is pure 3D — the real orthogonal
 * projection, `cos(angleRad)` — `t=1` is pure 4D — no foreshortening at
 * all, since within the true embedding the two cells are flush). Linear
 * interpolation between the two endpoints is what makes the slider a
 * genuine, continuous "breathe open/closed" rather than a snap between
 * two states.
 */
export function foldScale(angleRad: number, t: number): number {
  const cos = Math.cos(angleRad);
  return cos + t * (1 - cos);
}

/**
 * Applies the fold projection to one world-space vertex. Decomposes
 * `v - pivot` into its component along `axis` (unit vector, the shared
 * face's own outward normal in the already-flush pose) plus everything
 * perpendicular to it; only the axis component is scaled — every point
 * of the shared face itself (zero axis-component by construction) is
 * therefore an exact fixed point at any `t`, never moved by the fold.
 */
export function projectFoldedVertex(v: Vec3, pivot: Vec3, axis: Vec3, angleRad: number, t: number): Vec3 {
  const rel: Vec3 = [v[0] - pivot[0], v[1] - pivot[1], v[2] - pivot[2]];
  const along = rel[0] * axis[0] + rel[1] * axis[1] + rel[2] * axis[2];
  const scale = foldScale(angleRad, t);
  const delta = along * (scale - 1);
  return [v[0] + axis[0] * delta, v[1] + axis[1] * delta, v[2] + axis[2] * delta];
}

/**
 * The same fold, expressed as a single affine 4x4 matrix (16 numbers, row
 * major -- ready for `THREE.Matrix4.set(...)`) instead of a per-vertex
 * function -- Stage D's renderer applies this once per node per slider
 * change (not once per vertex per frame) by nesting each folded node's
 * mesh under a group whose own local matrix is exactly this. Mathematically
 * identical to calling `projectFoldedVertex` on every point (verified
 * directly in scripts/verify-fold4.ts against several arbitrary points,
 * not just asserted): `v -> pivot + scale*along*axis + perp` decomposes to
 * the linear map `L = I + (scale-1)*axis(x)axis` plus translation
 * `pivot - L*pivot`, kept in this file rather than duplicated at the call
 * site so the fold math has exactly one home.
 */
export function foldMatrix4RowMajor(pivot: Vec3, axis: Vec3, angleRad: number, t: number): number[] {
  const scale = foldScale(angleRad, t);
  const k = scale - 1;
  const [ax, ay, az] = axis;
  const m00 = 1 + k * ax * ax;
  const m01 = k * ax * ay;
  const m02 = k * ax * az;
  const m10 = k * ay * ax;
  const m11 = 1 + k * ay * ay;
  const m12 = k * ay * az;
  const m20 = k * az * ax;
  const m21 = k * az * ay;
  const m22 = 1 + k * az * az;

  const [px, py, pz] = pivot;
  const lpx = m00 * px + m01 * py + m02 * pz;
  const lpy = m10 * px + m11 * py + m12 * pz;
  const lpz = m20 * px + m21 * py + m22 * pz;
  const tx = px - lpx;
  const ty = py - lpy;
  const tz = pz - lpz;

  // prettier-ignore
  return [
    m00, m01, m02, tx,
    m10, m11, m12, ty,
    m20, m21, m22, tz,
    0,   0,   0,   1,
  ];
}
