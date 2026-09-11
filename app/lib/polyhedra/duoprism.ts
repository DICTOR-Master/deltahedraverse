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
const dotv = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Rotates `v` by 180deg about unit axis `a`: v' = 2(v.a)a - v. For any
 * v perpendicular to a, this simply negates v -- the general fact this
 * whole module leans on to make the far copy's connecting face point
 * BACK toward the near copy (see buildDuoprismShadow's own comment).
 */
function rotate180(v: Vec3, axis: Vec3): Vec3 {
  const d = dotv(v, axis);
  return sub(scale(axis, 2 * d), v);
}

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

export interface DuoprismFarCopyPlan {
  /** Local-frame translation from near's own center to far's own center. */
  offsetLocal: Vec3;
  /** A unit axis IN the connecting face's own plane (perpendicular to its normal), local frame. */
  flipAxisLocal: Vec3;
}

/**
 * The raw ingredients (local frame, no THREE.js) for placing a
 * duoprism's far copy for `faceIndex`: it must sit `offsetLocal` away
 * from near's own center, and be ROTATED 180deg about `flipAxisLocal`
 * (not left at the SAME orientation as near) so its own connecting
 * face points BACK toward near -- confirmed wrong live as a plain
 * translated copy ("top faces pointing the same way is wrong... they
 * should be facing opposite ways"; a plain translation made the far
 * cap extend the shape into an elongated "sausage" instead of closing
 * back into a legible duoprism). A caller with a real world transform
 * (ShapeViewer.tsx) rotates both vectors by near's own world
 * quaternion to place the real node; a caller working purely in local
 * coordinates (verification, or VIEW mode via a fixed shared axis
 * instead of a specific face) can apply rotate180 directly.
 */
export function duoprismFarCopyPlan(spec: PolyhedronSpec, faceIndex: number): DuoprismFarCopyPlan {
  const fc = buildFaceConnectors(spec)[faceIndex];
  const vertex0 = spec.vertices[spec.faces[faceIndex][0]];
  const flipAxisLocal = norm(sub(vertex0, fc.pos));
  const depth = duoprismBuildDepth(spec, faceIndex);
  const offsetLocal = scale(fc.normal, depth);
  return { offsetLocal, flipAxisLocal };
}

/** `spec.vertices`, rotated 180deg about `plan.flipAxisLocal` and translated by `plan.offsetLocal` -- the far copy's own LOCAL vertex positions (as if near sat at the identity transform). Used directly by verification; ShapeViewer.tsx applies its own world transform on top via the real quaternion instead (a mesh needs a real transform, not custom per-instance vertices). */
export function duoprismFarCopyVerticesLocal(spec: PolyhedronSpec, plan: DuoprismFarCopyPlan): Vec3[] {
  return spec.vertices.map((v) => add(rotate180(v, plan.flipAxisLocal), plan.offsetLocal));
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
export function buildWallPrism(nearFaceVerts: Vec3[], farFaceVerts: Vec3[]): WallPrismRaw {
  const n = nearFaceVerts.length;
  const nearVerts = nearFaceVerts;

  const nearCentroid = nearVerts.reduce((s, v) => add(s, v), [0, 0, 0] as Vec3).map((c) => c / n) as Vec3;
  const rawFarCentroid = farFaceVerts.reduce((s, v) => add(s, v), [0, 0, 0] as Vec3).map((c) => c / n) as Vec3;
  const offsetEstimate = sub(rawFarCentroid, nearCentroid);

  // Which far vertex is actually "across from" each near vertex -- NOT
  // necessarily the same array index. A plain translated far copy keeps
  // index k across from index k, but a REORIENTED far copy (the 180deg
  // flip this module now uses so the far cap points back toward near,
  // not away from it) also PERMUTES which vertex ends up across from
  // which: flipping a pentagon 180deg about the axis through its own
  // vertex 0 fixes vertex 0's own position but SWAPS vertices 1<->4 and
  // 2<->3 (confirmed live: connecting same-index vertices directly
  // produced exactly the self-crossing "twisted"/bowtie geometry
  // reported -- the earlier same-index assumption was only ever valid
  // for a pure translation). Matching each near vertex to its nearest
  // far vertex (after accounting for the overall near-to-far offset) is
  // the correct, general rule regardless of how the far cap got
  // oriented -- a real duoprism's far cap is never so skewed that its
  // OWN vertices are closer to the WRONG near vertex.
  const farIndexForNear: number[] = nearVerts.map((nv) => {
    const expected = add(nv, offsetEstimate);
    let bestJ = 0;
    let bestDist = Infinity;
    farFaceVerts.forEach((fv, j) => {
      const d = Math.hypot(...sub(fv, expected));
      if (d < bestDist) {
        bestDist = d;
        bestJ = j;
      }
    });
    return bestJ;
  });
  const farVerts = farIndexForNear.map((j) => farFaceVerts[j]);
  const verts = [...nearVerts, ...farVerts];

  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    edges.push([k, (k + 1) % n]);
    edges.push([n + k, n + ((k + 1) % n)]);
    edges.push([k, n + k]);
  }

  const farCentroid = farVerts.reduce((s, v) => add(s, v), [0, 0, 0] as Vec3).map((c) => c / n) as Vec3;
  const spineMid = scale(add(nearCentroid, farCentroid), 0.5);

  // Winding: build every face's vertex loop, then FIX UP its direction
  // by checking whether it actually points outward from the prism's own
  // spine midpoint -- reverse it if not. Predicting the right direction
  // in advance from a single "does offset agree with the near face's own
  // normal" test (an earlier version's approach) assumed the far cap is
  // a plain translated copy of the near one; it stopped being reliable
  // once the far cap could be independently reoriented (a 180deg flip,
  // not just a translation -- confirmed live: a flipped far cap can wind
  // its own vertex loop in the OPPOSITE cyclic direction from a simple
  // translation, breaking that prediction). Checking the real outward
  // direction directly, per face, is correct regardless of how the far
  // cap got where it is.
  const direct: number[] = Array.from({ length: n }, (_, k) => n + k);

  const orientFace = (loop: number[], allVerts: Vec3[], reference: Vec3): number[] => {
    const pts = loop.map((i) => allVerts[i]);
    const c = pts.reduce((s, v) => add(s, v), [0, 0, 0] as Vec3).map((x) => x / pts.length) as Vec3;
    const e1v = sub(pts[1], pts[0]);
    const e2v = sub(pts[2], pts[0]);
    const faceN = cross(e1v, e2v);
    const outward = sub(c, reference);
    return dot(faceN, outward) > 0 ? loop : [...loop].reverse();
  };

  const faces: number[][] = [];
  // Caps: a highly oblique far cap can sit closer to the spine midpoint
  // than to a truly "outward" direction, making spineMid an unreliable
  // reference for the CAPS specifically (still fine for the lateral
  // quads below, which stay roughly symmetric around it) -- the far
  // cap's own natural outward direction is "away from the near cap",
  // and vice versa, regardless of how oblique the connection is.
  faces.push(orientFace(Array.from({ length: n }, (_, k) => k), verts, farCentroid)); // near cap
  faces.push(orientFace(direct, verts, nearCentroid)); // far cap
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    faces.push(orientFace([k, k2, n + k2, n + k], verts, spineMid));
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
  /** Translation from the near ("A") cap's center to the far ("B") cap's center. */
  offset: Vec3;
  /**
   * The far cap's OWN vertex positions (same indexing as spec.vertices).
   * Unlike BUILD's own far copy (see duoprismFarCopyPlan), this stays a
   * PLAIN translated copy: BUILD's 180deg flip uses a well-defined axis
   * (through the specific attaching face's own vertex 0), but VIEW has
   * no single face to anchor a flip axis to -- DUOPRISM_VIEW_AXIS is a
   * generic direction unrelated to any one face, so an arbitrary
   * perpendicular flip axis has no principled vertex correspondence,
   * confirmed live to produce degenerate/wrongly-wound walls for
   * several antiprisms when tried. Left as a known, separate limitation
   * (VIEW's reference preview may still look elongated along the shared
   * axis for some shapes) rather than shipping a broken flip.
   */
  farVertices: Vec3[];
  /** One wall-prism per face of `spec`, same order as `spec.faces`. */
  walls: WallPrismRaw[];
}

/** The full reference-only "3D shadow" of `spec`'s duoprism: two copies of `spec` (the caller already has spec's own mesh for the near copy; farVertices gives the far one's own positions) plus one connecting wall-prism per face. */
export function buildDuoprismShadow(spec: PolyhedronSpec): DuoprismShadow {
  const offset = scale(DUOPRISM_VIEW_AXIS, duoprismViewDepth(spec));
  const farVertices = spec.vertices.map((v) => add(v, offset));
  const walls = spec.faces.map((face) => {
    const nearVerts = face.map((i) => spec.vertices[i]);
    const farVerts = face.map((i) => farVertices[i]);
    return buildWallPrism(nearVerts, farVerts);
  });
  return { offset, farVertices, walls };
}
