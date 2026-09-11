import { POLYHEDRA } from '../app/lib/polyhedra';
import { buildFaceConnectors } from '../app/lib/polyhedra/core';
import { closureClass, FOURD_CAPABLE_IDS } from '../app/lib/polyhedra/fourD';
import { edgeClosingCorrection, siblingClosingHalfAngleRad, type Vec3 } from '../app/lib/polyhedra/fold4';
import { isValidAssembly, type Assembly } from '../app/lib/assembly';

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
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a));

// Rodrigues' rotation formula: rotate `v` by `theta` radians around unit `axis`.
function rotateAround(v: Vec3, axis: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const term1 = scale(v, c);
  const term2 = scale(cross(axis, v), s);
  const term3 = scale(axis, dot(axis, v) * (1 - c));
  return add(add(term1, term2), term3);
}

function faceHasEdge(face: number[], i: number, j: number): boolean {
  const n = face.length;
  for (let k = 0; k < n; k++) {
    const a = face[k];
    const b = face[(k + 1) % n];
    if ((a === i && b === j) || (a === j && b === i)) return true;
  }
  return false;
}

function findAdjacentFacePair(spec: (typeof POLYHEDRA)[string]): [number, number] {
  const [i, j] = spec.edges[0];
  const sharing = spec.faces.map((f, idx) => ({ f, idx })).filter(({ f }) => faceHasEdge(f, i, j));
  return [sharing[0].idx, sharing[1].idx];
}

// (a) siblingClosingHalfAngleRad is exactly half of Stage A's own k=3
// defectDeg, for every FOURD-capable shape -- a real cross-check against
// fourD.ts's independently-verified closure table, not a restatement.
for (const id of FOURD_CAPABLE_IDS) {
  const spec = POLYHEDRA[id];
  const k3 = closureClass(spec).find((c) => c.k === 3)!;
  assert(k3.kind === '4d', `${id}: k=3 is classified 4d (required for this feature to apply at all)`);
  const expectedHalfDeg = k3.defectDeg / 2;
  const actualHalfDeg = (siblingClosingHalfAngleRad(spec)! * 180) / Math.PI;
  assert(near(actualHalfDeg, expectedHalfDeg, 1e-9), `${id}: siblingClosingHalfAngleRad = defectDeg/2 (${actualHalfDeg.toFixed(4)} vs ${expectedHalfDeg.toFixed(4)})`);
}
assert(siblingClosingHalfAngleRad(POLYHEDRA.D20) === null, 'D20 (icosahedron, not FOURD-capable) has no sibling-closing angle at all');

// (b) edgeClosingCorrection actually CLOSES the real, independently-
// measured gap -- not just "computes some angle". Two real DODECAHEDRON
// siblings, independently flush-attached to a shared parent's two
// adjacent faces, apply each side's own correction to a stand-in "far
// direction" vector and confirm the angle between them shrinks from the
// raw ~10.3deg defect down to ~0deg, not doubling to ~20.6deg (the
// tell-tale sign of an inverted rotation direction).
{
  const spec = POLYHEDRA.DODECAHEDRON;
  const [faceA, faceB] = findAdjacentFacePair(spec);
  const corrA = edgeClosingCorrection(spec, faceA, faceB)!;
  const corrB = edgeClosingCorrection(spec, faceB, faceA)!;
  assert(corrA !== null && corrB !== null, 'edgeClosingCorrection succeeds for a real adjacent DODECAHEDRON face pair');

  assert(
    near(corrA.pivot[0], corrB.pivot[0], 1e-9) && near(corrA.pivot[1], corrB.pivot[1], 1e-9) && near(corrA.pivot[2], corrB.pivot[2], 1e-9),
    'both sides agree on the same shared-edge pivot',
  );
  assert(near(corrA.angleRad, -corrB.angleRad, 1e-9), `the two sides' corrections are equal-and-opposite: ${corrA.angleRad} vs ${corrB.angleRad}`);

  const fc = buildFaceConnectors(spec);
  const perpOf = (p: Vec3): Vec3 => {
    const rel = sub(p, corrA.pivot);
    const along = dot(rel, corrA.axis);
    return norm(sub(rel, scale(corrA.axis, along)));
  };
  // rA/rB are the PARENT's own two adjacent-face directions (a sanity
  // check on the parent's own geometry, not the sibling gap itself --
  // this must equal the shape's plain dihedral angle).
  const rA = perpOf(fc[faceA].pos);
  const rB = perpOf(fc[faceB].pos);
  const dihedralMeasuredDeg = (Math.acos(Math.min(1, Math.max(-1, dot(rA, rB)))) * 180) / Math.PI;

  // The actual sibling gap is between each cell's OWN far side -- extend
  // rA/rB outward by one more full dihedral-angle step each (mirroring
  // how a real flush-attached copy continues past the shared edge),
  // exactly the same construction verify-4d-closure's own chained-edge
  // check used. thetaAB's sign picks which rotational sense is "away
  // from the other face" for each side.
  const thetaAB = Math.atan2(dot(corrA.axis, cross(rA, rB)), dot(rA, rB));
  const dihedralRad = (dihedralMeasuredDeg * Math.PI) / 180;
  const rFarA = rotateAround(rA, corrA.axis, -Math.sign(thetaAB) * dihedralRad);
  const rFarB = rotateAround(rB, corrA.axis, Math.sign(thetaAB) * dihedralRad);
  const rawGapDeg = (Math.acos(Math.min(1, Math.max(-1, dot(rFarA, rFarB)))) * 180) / Math.PI;
  const expected = closureClass(spec).find((c) => c.k === 3)!;
  assert(near(rawGapDeg, expected.defectDeg, 1e-6), `raw (uncorrected) far-side gap matches closureClass k=3 defectDeg: ${rawGapDeg.toFixed(4)} vs ${expected.defectDeg.toFixed(4)}`);

  // Apply each side's FULL (t=1) correction to its OWN far direction and
  // re-measure -- this is the actual claim to verify: does it CLOSE
  // (shrink toward 0), not open (grow toward 2x) or do nothing. The
  // correction rotates the whole cell (pivoting at the shared edge), so
  // it applies to the far-direction vector exactly the same way.
  const rFarAClosed = rotateAround(rFarA, corrA.axis, corrA.angleRad);
  const rFarBClosed = rotateAround(rFarB, corrB.axis, corrB.angleRad);
  const closedGapDeg = (Math.acos(Math.min(1, Math.max(-1, dot(rFarAClosed, rFarBClosed)))) * 180) / Math.PI;
  assert(closedGapDeg < 1e-6, `full correction on both sides closes the gap to ~0deg (was ${rawGapDeg.toFixed(4)}deg): got ${closedGapDeg.toFixed(6)}deg`);

  // A partial (t=0.5) correction should land strictly between the raw
  // gap and fully-closed.
  const rFarAHalf = rotateAround(rFarA, corrA.axis, corrA.angleRad * 0.5);
  const rFarBHalf = rotateAround(rFarB, corrB.axis, corrB.angleRad * 0.5);
  const halfGapDeg = (Math.acos(Math.min(1, Math.max(-1, dot(rFarAHalf, rFarBHalf)))) * 180) / Math.PI;
  assert(halfGapDeg > 0.1 && halfGapDeg < rawGapDeg - 0.1, `t=0.5 lands strictly between the raw gap and fully-closed: got ${halfGapDeg.toFixed(4)}deg (raw ${rawGapDeg.toFixed(4)}deg)`);
}

// (c) null-safety / sandboxing: ineligible shape, and non-adjacent faces.
{
  assert(edgeClosingCorrection(POLYHEDRA.D20, 0, 1) === null, 'edgeClosingCorrection null for a non-FOURD-capable shape');
  const spec = POLYHEDRA.DODECAHEDRON;
  // face 0 against itself is never a real "adjacent pair".
  assert(edgeClosingCorrection(spec, 0, 0) === null, 'edgeClosingCorrection null when the two face indices are the same');
}

// (d) Sandboxing guardrail carried over from the original design (direct
// user request: "4D needs sandboxing... gold badge access"): fold4 must
// be impossible to attach to anything outside FOURD_CAPABLE_IDS, across
// two DIFFERENT shapes, or on a vertex-kind connection. isValidAssembly
// is the actual, only gate for persisted data -- check it directly.
{
  const makeAssembly = (shapeA: string, shapeB: string, kind: 'face' | 'vertex' = 'face'): Assembly => ({
    nodes: [
      { id: 'a', shape: shapeA, transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] } },
      { id: 'b', shape: shapeB, transform: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] } },
    ],
    connections: [{ nodeA: 'a', vertexA: 0, nodeB: 'b', vertexB: 0, kind, fold4: true }],
  });

  assert(!isValidAssembly(makeAssembly('D20', 'D20')), 'fold4 rejected for D20 self-attach (not FOURD-capable)');
  assert(!isValidAssembly(makeAssembly('DODECAHEDRON', 'CUBE')), 'fold4 rejected across two DIFFERENT shapes (Stage-1 scope)');
  assert(isValidAssembly(makeAssembly('DODECAHEDRON', 'DODECAHEDRON')), 'fold4 accepted for a real DODECAHEDRON self-attach');
  assert(isValidAssembly(makeAssembly('CUBE', 'CUBE')), 'fold4 accepted for a real CUBE self-attach');
  assert(!isValidAssembly(makeAssembly('DODECAHEDRON', 'DODECAHEDRON', 'vertex')), 'fold4 rejected on a vertex-kind connection (no shared face plane to fold around)');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
