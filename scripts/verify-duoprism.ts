import { POLYHEDRA, POLYHEDRON_IDS } from '../app/lib/polyhedra';
import { FOURD_CAPABLE_IDS } from '../app/lib/polyhedra/fourD';
import {
  buildWallPrism,
  duoprismCombinatorics,
  duoprismBuildDepth,
  DUOPRISM_VIEW_AXIS,
  duoprismViewDepth,
  buildDuoprismShadow,
  type WallPrismRaw,
} from '../app/lib/polyhedra/duoprism';
import { buildFaceConnectors, type PolyhedronSpec } from '../app/lib/polyhedra/core';
import { isValidAssembly, type Assembly } from '../app/lib/assembly';

type Vec3 = [number, number, number];

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

// (1) Combinatorial 4D Euler-characteristic check -- every registered shape.
for (const id of POLYHEDRON_IDS) {
  const spec = POLYHEDRA[id];
  const { V, E, F, C } = duoprismCombinatorics(spec);
  const euler = V - E + F - C;
  assert(euler === 0, `${id}: duoprism 4D Euler characteristic V-E+F-C = ${euler} (want 0)`);
}

// (2) DUOPRISM_VIEW_AXIS non-degeneracy: never lies in any registered
// face's own plane (i.e. never perpendicular to a face's normal), for
// every face of every shape -- must fail LOUDLY, not silently, if this
// is ever violated by a future shape addition.
{
  let worstDot = Infinity;
  for (const id of POLYHEDRON_IDS) {
    const spec = POLYHEDRA[id];
    const connectors = buildFaceConnectors(spec);
    for (const fc of connectors) {
      const d = Math.abs(dot(DUOPRISM_VIEW_AXIS, fc.normal as Vec3));
      worstDot = Math.min(worstDot, d);
      assert(d > 1e-3, `${id} face ${fc.faceIndex}: DUOPRISM_VIEW_AXIS is NOT nearly parallel to this face's own plane (dot=${d.toFixed(6)})`);
    }
  }
  console.log('worst (smallest) |dot(axis, normal)| across all registered faces:', worstDot.toFixed(6));
}

// (3)+(4)+(5): winding correctness, cap congruence, and non-degeneracy of
// BUILD's real right prisms, for every face of the 4 FOURD_CAPABLE shapes.
function faceNormal(verts: Vec3[]): Vec3 {
  const e1 = sub(verts[1], verts[0]);
  const e2 = sub(verts[2], verts[0]);
  const c = cross(e1, e2);
  const len = Math.hypot(...c);
  return [c[0] / len, c[1] / len, c[2] / len];
}
function centroid(verts: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const v of verts) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; }
  return [c[0] / verts.length, c[1] / verts.length, c[2] / verts.length];
}
/** Fan-triangulates a convex face for the volume check below (same technique core.ts's own triangulateFace uses for rendering). */
function triangulate(face: number[]): [number, number, number][] {
  const tris: [number, number, number][] = [];
  for (let k = 1; k < face.length - 1; k++) tris.push([face[0], face[k], face[k + 1]]);
  return tris;
}
function checkWallPrism(label: string, wall: WallPrismRaw, offset: Vec3, expectRight: boolean) {
  // Whole-mesh signed volume (standard divergence-theorem / tetrahedra-
  // from-the-origin formula): for a CLOSED mesh with consistently
  // outward-wound faces, this is always positive, regardless of how
  // skewed/oblique the shape is -- a robust, standard check, unlike a
  // naive "does this face's normal point away from the mesh's own
  // vertex-average centroid" heuristic, which a first version of this
  // script used and found to give FALSE FAILURES on heavily oblique
  // VIEW-mode prisms (the vertex-average centroid itself skews toward
  // the offset direction for a skewed shape, making "away from it" an
  // unreliable proxy for "actually outward").
  let signedVolume6 = 0;
  for (const face of wall.faces) {
    for (const [i, j, k] of triangulate(face)) {
      const [a, b, c] = [wall.verts[i], wall.verts[j], wall.verts[k]];
      signedVolume6 += dot(a, cross(b, c));
    }
  }
  assert(signedVolume6 > 1e-9, `${label}: whole wall-prism mesh has positive signed volume (consistently outward winding), got ${(signedVolume6 / 6).toFixed(6)}`);

  // Per-face check too (the whole-mesh volume alone can't rule out two
  // individually-wrong faces cancelling out): reference point is the
  // midpoint between the two caps' own centroids -- the prism's real
  // "spine" midpoint, always genuinely interior regardless of skew,
  // unlike a raw vertex-average which skews toward whichever cap the
  // offset direction favors.
  const n = wall.verts.length / 2;
  const nearCentroid = centroid(wall.verts.slice(0, n));
  const farCentroid = centroid(wall.verts.slice(n));
  const spineMid: Vec3 = [(nearCentroid[0] + farCentroid[0]) / 2, (nearCentroid[1] + farCentroid[1]) / 2, (nearCentroid[2] + farCentroid[2]) / 2];
  for (const face of wall.faces) {
    const pts = face.map((i) => wall.verts[i]);
    const faceCentroid = centroid(pts);
    const fNormal = faceNormal(pts);
    const toOutside = sub(faceCentroid, spineMid);
    assert(dot(fNormal, toOutside) > 0, `${label}: face [${face.join(',')}] normal points outward from the prism's own spine midpoint`);
  }
  // Cap congruence: every far-cap vertex is exactly its near-cap
  // counterpart plus the SAME offset (proves "no registration needed").
  for (let k = 0; k < n; k++) {
    const nearV = wall.verts[k];
    const farV = wall.verts[n + k];
    const d = sub(farV, nearV);
    assert(near(d[0], offset[0], 1e-9) && near(d[1], offset[1], 1e-9) && near(d[2], offset[2], 1e-9), `${label}: far cap vertex ${k} = near cap vertex ${k} + offset exactly (no registration/twist needed)`);
  }
  // Non-degeneracy: every lateral quad has real (non-zero) area.
  for (let k = 2; k < wall.faces.length; k++) {
    const pts = wall.faces[k].map((i) => wall.verts[i]);
    const areaVec = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    assert(Math.hypot(...areaVec) > 1e-6, `${label}: lateral quad ${k} has non-degenerate area`);
  }
  if (expectRight) {
    // A right prism: the offset must be parallel to BOTH cap normals.
    const nearFace = wall.faces[0].map((i) => wall.verts[i]);
    const nCap = faceNormal(nearFace);
    const offsetNorm = Math.hypot(...offset);
    const cosAngle = Math.abs(dot(nCap, offset) / offsetNorm);
    assert(near(cosAngle, 1, 1e-6), `${label}: offset is parallel to the cap's own normal (right prism, cos=${cosAngle.toFixed(8)})`);
  }
}

// The check that should have existed from the start: do the near and far
// SOLID copies (the actual dodecahedra/cubes/etc, not just the connecting
// wall-prism) avoid occupying the same space? Measured directly by
// projecting every vertex of both copies onto the extrusion axis and
// confirming the near copy's forward extent never exceeds the far copy's
// backward extent -- a real bug shipped without this: `DUOPRISM_DEPTH=1`
// (borrowed from prisms.ts's own flat-2D-polygon convention) badly
// undersized the gap once the "caps" became full 3D solids with their
// own real depth along the very axis being extruded (confirmed live on
// DODECAHEDRON: needs >=2.227, not 1 -- a live user report, reproduced
// and measured, not guessed at).
function checkCapsDontOverlap(label: string, spec: PolyhedronSpec, offset: Vec3) {
  const axis = norm(offset);
  const nearProjections = spec.vertices.map((v) => dot(v as Vec3, axis));
  const farProjections = spec.vertices.map((v) => dot(v as Vec3, axis) + dot(offset, axis));
  const nearMaxForward = Math.max(...nearProjections);
  const farMinBackward = Math.min(...farProjections);
  assert(
    farMinBackward >= nearMaxForward - 1e-9,
    `${label}: near copy's forward extent (${nearMaxForward.toFixed(4)}) does not exceed far copy's backward extent (${farMinBackward.toFixed(4)}) -- the two solids don't overlap`,
  );
}

for (const id of FOURD_CAPABLE_IDS) {
  const spec = POLYHEDRA[id];
  const connectors = buildFaceConnectors(spec);
  spec.faces.forEach((face, faceIndex) => {
    const faceVerts = face.map((i) => spec.vertices[i]) as Vec3[];
    const normal = connectors[faceIndex].normal as Vec3;
    const depth = duoprismBuildDepth(spec, faceIndex);
    const offset: Vec3 = [normal[0] * depth, normal[1] * depth, normal[2] * depth];
    const wall = buildWallPrism(faceVerts, offset);
    checkWallPrism(`${id} face ${faceIndex} (BUILD)`, wall, offset, true);
    checkCapsDontOverlap(`${id} face ${faceIndex} (BUILD)`, spec, offset);
  });
}

// Same checks for VIEW's oblique shadow, all 137 shapes (winding/congruence/non-degeneracy still must hold; NOT expected to be right prisms)
// PLUS the same cap-overlap check the BUILD-mode bug above was missing.
for (const id of POLYHEDRON_IDS) {
  const spec = POLYHEDRA[id];
  const shadow = buildDuoprismShadow(spec);
  spec.faces.forEach((_, faceIndex) => {
    checkWallPrism(`${id} face ${faceIndex} (VIEW)`, shadow.walls[faceIndex], shadow.offset, false);
  });
  checkCapsDontOverlap(`${id} (VIEW)`, spec, shadow.offset);
}
assert(duoprismViewDepth(POLYHEDRA.DODECAHEDRON) > 0, 'duoprismViewDepth is positive for a real shape');

// (6) Chaining / no-sibling-gap claim, computed directly: a DODECAHEDRON
// with TWO duoprism wall-prisms on two DIFFERENT faces must not disturb
// the shared parent's own geometry, and the two resulting offsets must
// differ (two different faces of a convex polyhedron never share an
// outward normal).
{
  const spec = POLYHEDRA.DODECAHEDRON;
  const connectors = buildFaceConnectors(spec);
  const facesToTest = [0, 1]; // any two distinct faces suffice; verified adjacent-or-not doesn't matter for this claim
  const verticesBefore = spec.vertices.map((v) => [...v]);

  const offsets = facesToTest.map((f) => {
    const n = connectors[f].normal as Vec3;
    const depth = duoprismBuildDepth(spec, f);
    return [n[0] * depth, n[1] * depth, n[2] * depth] as Vec3;
  });
  const walls = facesToTest.map((f, idx) => {
    const faceVerts = spec.faces[f].map((i) => spec.vertices[i]) as Vec3[];
    return buildWallPrism(faceVerts, offsets[idx]);
  });
  facesToTest.forEach((f, idx) => checkCapsDontOverlap(`chained sibling ${idx}`, spec, offsets[idx]));

  const verticesAfter = spec.vertices;
  assert(
    verticesBefore.every((v, i) => v[0] === verticesAfter[i][0] && v[1] === verticesAfter[i][1] && v[2] === verticesAfter[i][2]),
    'building two duoprism wall-prisms on different faces leaves the shared parent DODECAHEDRON node byte-identical',
  );
  const offsetDist = Math.hypot(...sub(offsets[0], offsets[1]));
  assert(offsetDist > 0.1, `the two siblings' translation offsets genuinely differ (dist=${offsetDist.toFixed(4)}) -- no coincidence between two different faces' attaches`);
  walls.forEach((wall, idx) => checkWallPrism(`chained sibling ${idx}`, wall, offsets[idx], true));
}

// (7) isValidAssembly gating for the new 'duoprism' connection kind.
{
  const makeAssembly = (shapeA: string, shapeB: string, vertexA: number, vertexB: number): Assembly => ({
    nodes: [
      { id: 'a', shape: shapeA, transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] } },
      { id: 'b', shape: shapeB, transform: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] } },
    ],
    connections: [{ nodeA: 'a', vertexA, nodeB: 'b', vertexB, kind: 'duoprism' }],
  });

  assert(!isValidAssembly(makeAssembly('D20', 'D20', 0, 0)), 'duoprism rejected for D20 (not FOURD-capable)');
  assert(!isValidAssembly(makeAssembly('DODECAHEDRON', 'CUBE', 0, 0)), 'duoprism rejected across two DIFFERENT shapes');
  assert(!isValidAssembly(makeAssembly('DODECAHEDRON', 'DODECAHEDRON', 0, 1)), 'duoprism rejected when vertexA !== vertexB (same face required on both sides)');
  assert(isValidAssembly(makeAssembly('DODECAHEDRON', 'DODECAHEDRON', 0, 0)), 'duoprism accepted for a real same-shape FOURD-capable pair with matching face index');
  assert(isValidAssembly(makeAssembly('CUBE', 'CUBE', 2, 2)), 'duoprism accepted for a real CUBE self-pair');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
