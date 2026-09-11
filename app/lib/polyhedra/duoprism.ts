/**
 * The 4D Prism (duoprism) construction: for any polyhedron P, the 4D
 * shape P x [0, depth] -- exactly how a tesseract is a cube extruded
 * along a 4th axis, generalized to any already-registered shape. Unlike
 * the OTHER 4D feature in this app (fold4.ts's dihedral-defect self-
 * attach, which needs a real angular gap to close and, past an isolated
 * pair, provably can't close it exactly with only 3D rotations — see
 * fourD.ts/fold4.ts's own comments), a duoprism has NO curvature at all:
 * it's a flat Cartesian product with an interval, so it embeds in
 * ordinary 3D with zero approximation, for ANY shape, at ANY density of
 * chained attachments.
 *
 * The construction: two copies of P ("caps," translated relative to
 * each other along one chosen axis, in the SAME orientation -- unlike an
 * ordinary face-attach or fold4 join of two DIFFERENT solids, a
 * duoprism's far cap IS the same polyhedron, not a mirrored copy, so
 * there's no registration/twist choice at all) plus one 3D prism cell
 * per FACE of P (replacing "one rectangle per EDGE" in `prisms.ts`'s own
 * ordinary 3D prism, one dimension up), connecting each face's near
 * copy to its far copy. `buildWallPrism` below reuses `prisms.ts`'s
 * exact near-cap-reversed / far-cap-direct winding convention.
 */

import { buildFaceConnectors, type Vec3, type PolyhedronSpec } from './core';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a));

/**
 * The minimum depth needed for the near and far copies to NOT overlap
 * along `axis`: the shape's own real extent along that exact axis (the
 * distance between its furthest-forward and furthest-backward vertex
 * projections), not an approximation. A real bug shipped without this
 * check: an earlier version used a flat `DUOPRISM_DEPTH = 1` (matching
 * `prisms.ts`'s own top-to-bottom span for extruding a FLAT 2D polygon,
 * which has no depth of its own) — but here both "caps" are full 3D
 * solids with real depth along the very axis being extruded, so that
 * constant badly undersized the gap for anything much bigger than a
 * tetrahedron (confirmed live: DODECAHEDRON needs >=2.227 just to touch,
 * not 1 — real user report, "overlapping everywhere," reproduced and
 * measured directly, not guessed at). This function returns the EXACT
 * touching distance for the given axis; callers add their own margin
 * for a visible gap.
 */
function minNonOverlapDepth(spec: PolyhedronSpec, axis: Vec3): number {
  const projections = spec.vertices.map((v) => dot(v, axis));
  return Math.max(...projections) - Math.min(...projections);
}

/**
 * BUILD mode's wall-prism depth for a specific face: `minNonOverlapDepth`
 * along that face's own normal, plus a 15% margin for a real visible gap
 * rather than the two copies' faces looking fused.
 *
 * A first version of this used "2x that face's own apothem" instead,
 * reasoning that a convex shape's boundary never extends past its own
 * face plane along that face's own normal, so the near copy's forward
 * extent (=apothem) should equal the far copy's backward extent
 * (=apothem again, by symmetry). That symmetry assumption is only true
 * for a CENTRALLY SYMMETRIC shape (opposite faces parallel and
 * equidistant from center) — CUBE, D8, and DODECAHEDRON all happen to
 * have it, but D4 (tetrahedron) does NOT: the vertex opposite a face
 * sits at the shape's own real HEIGHT from that face (~0.817 for a
 * unit-edge tetrahedron), not at 2x the apothem (~0.408) — caught live
 * (D4 alone, not the other 3, failing the real overlap check below)
 * rather than assumed safe from the apothem shortcut. Measuring the
 * real extent directly via `minNonOverlapDepth`, exactly like VIEW's
 * own depth already does, removes the symmetry assumption entirely.
 */
export function duoprismBuildDepth(spec: PolyhedronSpec, faceIndex: number): number {
  const normal = buildFaceConnectors(spec)[faceIndex].normal;
  return minNonOverlapDepth(spec, normal) * 1.15;
}

export interface WallPrismRaw {
  /** 2n verts: [0..n-1] = near cap (face's own order, REVERSED), [n..2n-1] = far cap (face's own order, direct). */
  verts: Vec3[];
  edges: [number, number][];
  /** [nearCap, farCap, ...n lateral quads]. */
  faces: number[][];
}

/**
 * The connecting 3D prism cell for one face of a duoprism, given that
 * face's own vertex positions (`faceVerts`, already resolved in
 * whatever coordinate frame the caller wants -- shape-local for the
 * reference VIEW, or world-space for a real BUILD attach) and the
 * translation to the far copy (`offset`). A RIGHT prism when `offset`
 * is parallel to the face's own normal (BUILD mode, always exact); an
 * OBLIQUE prism otherwise (VIEW mode's single shared axis is generally
 * not perpendicular to any one face -- correct and expected, matching
 * how a real tesseract diagram shows most of its 8 cells as skewed
 * frustums under one shared projection direction, not 8 identical
 * cubes).
 *
 * Winding: the face's own stored order has a NATURAL normal (computed
 * directly from its own first 3 points, same technique
 * `buildFaceConnectors` uses) that may point either WITH or AGAINST
 * `offset`, depending on the caller: BUILD always passes `offset`
 * parallel to that exact face's own normal (so always WITH it, by
 * construction), but VIEW's single shared axis generally does NOT agree
 * in sign with every face's own normal (roughly half of any convex
 * shape's faces will disagree under one fixed direction) -- confirmed
 * live, not assumed: an earlier version of this function always
 * reversed the near cap and kept the far cap direct unconditionally,
 * which produced an inverted (negative-volume, inconsistently-wound)
 * mesh for every VIEW-mode face where the fixed axis opposed that
 * face's own normal (scripts/verify-duoprism.ts caught this via a
 * whole-mesh signed-volume check). The correct, general rule: whichever
 * cap's NATURAL winding already points away from the OTHER cap is kept
 * direct; the other is reversed. When `dot(faceNormal, offset) > 0`
 * (BUILD, always; VIEW, about half the time) that's near-reversed/
 * far-direct (the original derivation); when negative, it's the mirror
 * image, near-direct/far-reversed.
 */
export function buildWallPrism(faceVerts: Vec3[], offset: Vec3): WallPrismRaw {
  const n = faceVerts.length;
  const nearVerts = faceVerts;
  const farVerts = faceVerts.map((v) => add(v, offset));
  const verts = [...nearVerts, ...farVerts];

  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    edges.push([k, (k + 1) % n]);
    edges.push([n + k, n + ((k + 1) % n)]);
    edges.push([k, n + k]);
  }

  const e1 = sub(faceVerts[1], faceVerts[0]);
  const e2 = sub(faceVerts[2], faceVerts[0]);
  const naturalNormal = cross(e1, e2);
  const agreesWithOffset = dot(naturalNormal, offset) > 0;

  const faces: number[][] = [];
  const reversed: number[] = [];
  for (let k = 0; k < n; k++) reversed.push((n - k) % n);
  const direct: number[] = [];
  for (let k = 0; k < n; k++) direct.push(n + k);
  const reversedFar: number[] = [];
  for (let k = 0; k < n; k++) reversedFar.push(n + ((n - k) % n));
  const directNear: number[] = Array.from({ length: n }, (_, k) => k);

  if (agreesWithOffset) {
    faces.push(reversed); // near cap
    faces.push(direct); // far cap
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      faces.push([k, k2, n + k2, n + k]);
    }
  } else {
    faces.push(directNear); // near cap
    faces.push(reversedFar); // far cap
    // Lateral quads reverse too (confirmed live, not assumed: an
    // earlier version kept the same [k,k2,n+k2,n+k] order unconditionally
    // and scripts/verify-duoprism.ts caught inverted laterals here via
    // the same whole-mesh volume check) -- swapping k/k2 flips the
    // quad's own winding to match the flipped caps.
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      faces.push([k2, k, n + k, n + k2]);
    }
  }

  return { verts, edges, faces };
}

/**
 * The lateral (wall) quads only, excluding the near/far cap faces.
 * Every real caller renders the wall ALONGSIDE two already-solid,
 * already-capped copies of the shape (a real placed node at each end in
 * BUILD mode; a separately-drawn capGeometry mesh at each end in VIEW
 * mode) -- rendering the wall's OWN cap triangles too duplicates
 * geometry that's already there, and since the cap's own winding
 * (`reversed`/`direct`, chosen for the WHOLE mesh's outward-normal
 * consistency) doesn't match the solid's own natural face
 * triangulation, the two overlapping, differently-diagonalized
 * pentagons/triangles visibly cross near the middle -- a real, reported
 * artifact ("edges attaching to face centers", confirmed live as the
 * near/far cap triangulations disagreeing), not a subtle rendering
 * preference. checkWallPrism in scripts/verify-duoprism.ts still
 * verifies the FULL mesh (caps included) for winding/volume
 * correctness -- this only changes what actually gets drawn.
 */
export function wallLateralFaces(wall: WallPrismRaw): number[][] {
  return wall.faces.slice(2);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export interface DuoprismCombinatorics {
  V: number;
  E: number;
  F: number;
  C: number;
}

/**
 * The duoprism's own 4D vertex/edge/2-face/3-cell counts, derived from
 * P's ordinary V/E/F alone: 2V vertices (two full copies), 2E+V edges
 * (each copy's own edges, plus one connecting edge per vertex), 2F+E
 * 2-faces (each copy's own faces, plus one lateral quad per edge of P),
 * 2+F 3-cells (the two whole-P caps, plus one wall-prism per face of
 * P). See scripts/verify-duoprism.ts for the 4D Euler-characteristic
 * check this satisfies automatically once P's own V-E+F=2 holds.
 */
export function duoprismCombinatorics(spec: PolyhedronSpec): DuoprismCombinatorics {
  const V = spec.vertices.length;
  const E = spec.edges.length;
  const F = spec.faces.length;
  return { V: 2 * V, E: 2 * E + V, F: 2 * F + E, C: 2 + F };
}

/**
 * VIEW mode's single, fixed, shape-independent extrusion direction --
 * deliberately NOT axis-aligned (so it isn't coincidentally
 * perpendicular OR parallel to some face of some shape purely by
 * geometric accident) and NOT per-shape/per-face like BUILD's own axis.
 * One shared direction makes the reference picture read as "one
 * polyhedron extruded through one 4th axis," matching a real tesseract
 * diagram, rather than `f` unrelated right prisms glued at odd angles.
 * Verified (scripts/verify-duoprism.ts) to never lie in any of the 137
 * registered shapes' own face planes -- if that ever changed with a
 * future shape addition, the script fails loudly rather than silently
 * shipping a degenerate wall-prism. Chosen by a random search over the
 * whole live registry (not hand-picked) maximizing the worst-case
 * |dot(axis, faceNormal)| across all 3565 registered faces -- an
 * earlier arbitrary choice ([0.53, 1.0, 1.73], worst case ~0.00007)
 * came within numerical noise of lying in a real face's plane for 6
 * different shapes (caught directly by this file's own verification
 * script, not assumed safe); this one's worst case is ~0.012, three
 * orders of magnitude further from degenerate.
 */
export const DUOPRISM_VIEW_AXIS: Vec3 = norm([0.8742315094966826, -0.42353828345368133, -0.23734908942791608]);

/**
 * VIEW mode's depth for `spec`: `minNonOverlapDepth` along
 * `DUOPRISM_VIEW_AXIS` specifically (the shape's own REAL extent along
 * that exact generic axis), not a circumradius-based approximation. An
 * earlier version used `maxVertexRadius * 1.2` — circumradius is the
 * worst-case distance in ANY direction, but a shape's real extent along
 * one SPECIFIC generic (non-face-normal) axis can be smaller OR, for an
 * axis nearly aligned with a vertex-to-vertex diagonal, approach nearly
 * TWICE the circumradius — an approximation, not the exact figure this
 * needs (the same class of bug BUILD's own depth had, caught by the
 * same live report). Measuring the real extent directly removes the
 * guesswork entirely.
 */
export function duoprismViewDepth(spec: PolyhedronSpec): number {
  return minNonOverlapDepth(spec, DUOPRISM_VIEW_AXIS) * 1.15;
}

export interface DuoprismShadow {
  /** Translation from the near ("A") cap to the far ("B") cap -- add this to `spec.vertices` for B's own positions. */
  offset: Vec3;
  /** One wall-prism per face of `spec`, same order as `spec.faces`. */
  walls: WallPrismRaw[];
}

/** The full reference-only "3D shadow" of `spec`'s duoprism: two copies of `spec` (the caller already has spec's own mesh for the near copy; add `offset` for the far one) plus one connecting wall-prism per face. */
export function buildDuoprismShadow(spec: PolyhedronSpec): DuoprismShadow {
  const offset = scale(DUOPRISM_VIEW_AXIS, duoprismViewDepth(spec));
  const walls = spec.faces.map((face) => buildWallPrism(face.map((i) => spec.vertices[i]), offset));
  return { offset, walls };
}
