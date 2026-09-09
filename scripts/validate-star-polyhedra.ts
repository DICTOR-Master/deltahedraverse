/**
 * Real verification for the 4 Kepler-Poinsot solids (docs/
 * star-polyhedra-spec.md): validateShape's own generic checks (edge
 * length, handshake lemma, face count) PLUS the star-specific facts this
 * family's own construction needs verified that no other family does --
 * every face's winding is genuinely outward (not just during
 * construction, checked again here independently against the actual
 * exported spec), and V/E/F/density match the real published Kepler-
 * Poinsot table, not just whatever the construction code happened to
 * produce.
 */
import { STAR_POLYHEDRA, STAR_POLYHEDRON_IDS, STAR_POLYHEDRON_META } from '../app/lib/polyhedra/starPolyhedra';
import { validateShape, dist, type Vec3 } from '../app/lib/polyhedra/core';

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function centroidOf(vs: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const v of vs) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  return [c[0] / vs.length, c[1] / vs.length, c[2] / vs.length];
}

// Published Kepler-Poinsot invariants -- the real ground truth this
// derivation is checked against, not just internal self-consistency.
const EXPECTED: Record<string, { v: number; e: number; f: number; faceSize: number; density: number }> = {
  GREAT_DODECAHEDRON: { v: 12, e: 30, f: 12, faceSize: 5, density: 3 },
  SMALL_STELLATED_DODECAHEDRON: { v: 12, e: 30, f: 12, faceSize: 5, density: 3 },
  GREAT_STELLATED_DODECAHEDRON: { v: 20, e: 30, f: 12, faceSize: 5, density: 7 },
  GREAT_ICOSAHEDRON: { v: 12, e: 30, f: 20, faceSize: 3, density: 7 },
};

let failed = false;
for (const id of STAR_POLYHEDRON_IDS) {
  const spec = STAR_POLYHEDRA[id];
  const problems = validateShape(spec);
  const expected = EXPECTED[id];

  if (spec.vertices.length !== expected.v) problems.push(`vertex count ${spec.vertices.length} != expected ${expected.v}`);
  if (spec.edges.length !== expected.e) problems.push(`edge count ${spec.edges.length} != expected ${expected.e}`);
  if (spec.faces.length !== expected.f) problems.push(`face count ${spec.faces.length} != expected ${expected.f}`);
  for (const face of spec.faces) {
    if (face.length !== expected.faceSize) problems.push(`face [${face.join(',')}] has ${face.length} vertices, expected ${expected.faceSize}`);
  }

  // Real winding check, independent of the construction code's own
  // ensureOutward step -- every face's own computed normal must point
  // the same direction as its centroid (shape is centered at origin).
  for (const face of spec.faces) {
    const pts = face.map((i) => spec.vertices[i]);
    const c = centroidOf(pts);
    const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    if (dot(n, c) <= 0) problems.push(`face [${face.join(',')}] is wound INWARD, not outward`);
  }

  // Real regularity check beyond validateShape's unit-edge-length check:
  // every edge in the WHOLE shape (not just each face loop) must be the
  // same length -- confirms edgesFromFaces() didn't pick up any stray
  // non-regular edge.
  const lengths = spec.edges.map(([a, b]) => dist(spec.vertices[a], spec.vertices[b]));
  const maxDev = Math.max(...lengths.map((l) => Math.abs(l - 1)));
  if (maxDev > 1e-6) problems.push(`edge lengths vary by up to ${maxDev.toFixed(8)} (should all be exactly 1, unit-edge-normalized)`);

  const meta = STAR_POLYHEDRON_META[id];
  if (!meta || meta.density !== expected.density) {
    problems.push(`density ${meta?.density} != published ${expected.density}`);
  }

  if (problems.length === 0) {
    console.log(`${id}: OK (V=${spec.vertices.length} E=${spec.edges.length} F=${spec.faces.length}, density ${meta.density}, ${meta.schlafli})`);
  } else {
    failed = true;
    console.log(`${id}: FAILED`);
    for (const p of problems) console.log(`  ${p}`);
  }
}
if (failed) process.exit(1);
