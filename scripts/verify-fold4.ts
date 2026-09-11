import { POLYHEDRA } from '../app/lib/polyhedra';
import { buildFaceConnectors } from '../app/lib/polyhedra/core';
import { closureClass, dihedralAngleDeg, FOURD_CAPABLE_IDS } from '../app/lib/polyhedra/fourD';
import { foldAngleRad, foldMatrix4RowMajor, foldScale, projectFoldedVertex, type Vec3 } from '../app/lib/polyhedra/fold4';
import { isValidAssembly, type Assembly } from '../app/lib/assembly';

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
  const k = axis;
  const term1 = scale(v, c);
  const term2 = scale(cross(k, v), s);
  const term3 = scale(k, dot(k, v) * (1 - c));
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

// (a) Pivot invariance: any point exactly ON the pivot plane (zero
// axis-component) must be an exact fixed point of the fold, at ANY
// angle and ANY t -- the shared face itself never moves. Checked with a
// non-trivial, non-axis-aligned pivot/axis, not a convenient special
// case.
{
  const pivot: Vec3 = [1, -2, 0.5];
  const axisRaw: Vec3 = [1, 1, 1];
  const len = Math.hypot(...axisRaw);
  const axis: Vec3 = [axisRaw[0] / len, axisRaw[1] / len, axisRaw[2] / len];
  // A point on the pivot plane: pivot + any vector perpendicular to axis.
  const perp: Vec3 = [1, -1, 0]; // dot with (1,1,1)/sqrt3 is 0
  const onPlane: Vec3 = [pivot[0] + perp[0], pivot[1] + perp[1], pivot[2] + perp[2]];
  for (const angleDeg of [30, 63.435, 90, 116.565]) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const angleRad = (angleDeg * Math.PI) / 180;
      const result = projectFoldedVertex(onPlane, pivot, axis, angleRad, t);
      assert(
        near(result[0], onPlane[0]) && near(result[1], onPlane[1]) && near(result[2], onPlane[2]),
        `pivot-plane point is a fixed point at angle=${angleDeg}deg t=${t}: got ${JSON.stringify(result)}`,
      );
    }
  }
}

// (a2) foldScale is the linear interpolation its own doc comment
// promises: cos(angle) at t=0 (pure 3D), 1 (flush, no foreshortening) at
// t=1 (pure 4D), and the midpoint exactly halfway between the two.
{
  const angleRad = Math.PI / 3; // 60deg, cos = 0.5, arbitrary non-degenerate angle
  assert(near(foldScale(angleRad, 0), 0.5), `foldScale t=0 is cos(angle): got ${foldScale(angleRad, 0)}`);
  assert(near(foldScale(angleRad, 1), 1), `foldScale t=1 is 1 (flush): got ${foldScale(angleRad, 1)}`);
  assert(near(foldScale(angleRad, 0.5), 0.75), `foldScale t=0.5 is the exact midpoint of cos(angle) and 1: got ${foldScale(angleRad, 0.5)}`);
}

// (a3) foldMatrix4RowMajor (Stage D's per-node render matrix) must be
// exactly equivalent to projectFoldedVertex applied point-by-point --
// checked against several arbitrary points with a non-trivial pivot/axis,
// not just at the origin where a translation-formula bug could hide.
{
  const pivot: Vec3 = [2, -1, 3];
  const axisRaw: Vec3 = [2, -1, 2];
  const axis = norm(axisRaw);
  const angleRad = (63.4349 * Math.PI) / 180;
  const m = foldMatrix4RowMajor(pivot, axis, angleRad, 0.37);
  const applyMatrix = (v: Vec3): Vec3 => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3],
    m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7],
    m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11],
  ];
  for (const v of [[5, 0, 0], [0, -4, 2], [1.5, 2.5, -3.5], pivot] as Vec3[]) {
    const viaMatrix = applyMatrix(v);
    const viaFunction = projectFoldedVertex(v, pivot, axis, angleRad, 0.37);
    assert(
      near(viaMatrix[0], viaFunction[0], 1e-9) && near(viaMatrix[1], viaFunction[1], 1e-9) && near(viaMatrix[2], viaFunction[2], 1e-9),
      `foldMatrix4RowMajor matches projectFoldedVertex for v=${JSON.stringify(v)}: ${JSON.stringify(viaMatrix)} vs ${JSON.stringify(viaFunction)}`,
    );
  }
}

// (b) CUBE self-attach, k=3, Delta=90deg: at t=0 (pure 3D projection),
// cos(90deg)=0 collapses the ENTIRE axis-component to zero -- the
// neighbor's projected shadow fully flattens onto the shared face plane.
// A known, correct tesseract-viewed-edge-on degeneracy, not a bug.
{
  const angleRad = foldAngleRad(POLYHEDRA.CUBE)!;
  assert(near((angleRad * 180) / Math.PI, 90, 1e-6), `CUBE foldAngleRad is 90deg: got ${(angleRad * 180) / Math.PI}`);
  const pivot: Vec3 = [0, 0, 0];
  const axis: Vec3 = [0, 0, 1];
  const farPoint: Vec3 = [3, 4, 5]; // axis-component = 5
  const projected = projectFoldedVertex(farPoint, pivot, axis, angleRad, 0);
  assert(near(projected[2], 0, 1e-9), `CUBE k=3 fold at t=0 fully collapses the axis-component: got ${projected[2]}`);
  assert(near(projected[0], 3) && near(projected[1], 4), `CUBE k=3 fold leaves the perpendicular components untouched: got [${projected[0]},${projected[1]}]`);
  // t=1 (pure 4D) must leave it completely unchanged -- flush.
  const flush = projectFoldedVertex(farPoint, pivot, axis, angleRad, 1);
  assert(near(flush[0], 3) && near(flush[1], 4) && near(flush[2], 5), `CUBE fold at t=1 is unchanged (flush): got ${JSON.stringify(flush)}`);
}

// (c) foldAngleRad and dihedralAngleDeg must stay derived from the exact
// same underlying angle for every FOURD-capable shape -- guards against
// the two modules silently drifting apart from each other over time.
for (const id of FOURD_CAPABLE_IDS) {
  const dihedral = dihedralAngleDeg(POLYHEDRA[id])!;
  const expectedFoldDeg = 180 - dihedral;
  const actualFoldDeg = (foldAngleRad(POLYHEDRA[id])! * 180) / Math.PI;
  assert(near(actualFoldDeg, expectedFoldDeg, 1e-9), `${id}: foldAngleRad = 180 - dihedralAngleDeg (${actualFoldDeg.toFixed(4)} vs ${expectedFoldDeg.toFixed(4)})`);
}
assert(foldAngleRad(POLYHEDRA.D20) === null, 'D20 (icosahedron, not FOURD-capable) has no fold angle at all');

// (c) Chain 3 real DODECAHEDRON cells fanned around one shared edge and
// confirm the residual gap matches closureClass's own k=3 defectDeg
// (~10.3deg) -- a genuine geometric cross-check of dihedralAngleDeg
// against actual rotation composition around a real edge taken from the
// shape's own vertex/edge data, not a restatement of the same formula.
// Each dodecahedron's two faces meeting at an edge are exactly one
// dihedral-angle step apart (a standard fact: the interior dihedral
// angle IS the angle, in the plane perpendicular to the edge, between
// the two half-planes containing the respective faces) -- so composing
// that same rotation twice more, starting from one real adjacent-face
// pair, models 3 flush-attached copies fanned around the shared edge.
{
  const spec = POLYHEDRA.DODECAHEDRON;
  const angleDeg = dihedralAngleDeg(spec)!;
  const faceConnectors = buildFaceConnectors(spec);
  const [i, j] = spec.edges[0];
  const sharing = spec.faces.map((face, index) => ({ face, index })).filter(({ face }) => faceHasEdge(face, i, j));
  assert(sharing.length === 2, 'DODECAHEDRON edges[0] borders exactly 2 faces (manifold solid)');

  const pivot = scale(add(spec.vertices[i], spec.vertices[j]), 0.5);
  const axis = norm(sub(spec.vertices[j], spec.vertices[i]));
  const perpOf = (facePos: Vec3): Vec3 => {
    const rel = sub(facePos, pivot);
    const along = dot(rel, axis);
    return norm(sub(rel, scale(axis, along)));
  };

  const r0 = perpOf(faceConnectors[sharing[0].index].pos);
  const r1 = perpOf(faceConnectors[sharing[1].index].pos);
  const measuredDeg = (Math.acos(Math.min(1, Math.max(-1, dot(r0, r1)))) * 180) / Math.PI;
  assert(near(measuredDeg, angleDeg, 1e-6), `real adjacent-face pair is exactly one dihedral-angle step apart: got ${measuredDeg.toFixed(4)}deg vs dihedralAngleDeg ${angleDeg.toFixed(4)}deg`);

  // Signed rotation from r0 to r1 in the correct rotational sense (about
  // `axis`), reapplied twice more to reach r2 (cell2's far face / cell3's
  // near face) and r3 (cell3's own far, open face).
  const theta = Math.atan2(dot(axis, cross(r0, r1)), dot(r0, r1));
  const r2 = rotateAround(r1, axis, theta);
  const r3 = rotateAround(r2, axis, theta);

  const gapDeg = (Math.acos(Math.min(1, Math.max(-1, dot(r0, r3)))) * 180) / Math.PI;
  const expected = closureClass(spec).find((c) => c.k === 3)!;
  assert(expected.kind === '4d', 'DODECAHEDRON k=3 is classified 4d by closureClass');
  assert(near(gapDeg, expected.defectDeg, 1e-6), `3-cell chain around a real shared edge leaves a ${gapDeg.toFixed(4)}deg gap, matching closureClass k=3 defectDeg ${expected.defectDeg.toFixed(4)}deg`);
  assert(near(gapDeg, 10.3, 0.05), `residual gap is ~10.3deg as the plan's own worked example expects: got ${gapDeg.toFixed(4)}`);
}

// (d) Sandboxing guardrail (direct user request): fold4 must be
// impossible to attach to anything outside FOURD_CAPABLE_IDS, and
// impossible across two DIFFERENT shapes even if both are individually
// FOURD-capable (Stage-1 scope: self-attach only) -- isValidAssembly is
// the actual, only gate; check it directly rather than trusting the UI
// alone to never offer the option.
{
  const makeAssembly = (shapeA: string, shapeB: string): Assembly => ({
    nodes: [
      { id: 'a', shape: shapeA, transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] } },
      { id: 'b', shape: shapeB, transform: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] } },
    ],
    connections: [{ nodeA: 'a', vertexA: 0, nodeB: 'b', vertexB: 0, kind: 'face', fold4: true }],
  });

  assert(!isValidAssembly(makeAssembly('D20', 'D20')), 'fold4 rejected for D20 self-attach (not FOURD-capable)');
  assert(!isValidAssembly(makeAssembly('DODECAHEDRON', 'CUBE')), 'fold4 rejected across two DIFFERENT shapes, even though both are FOURD-capable individually (Stage-1 scope)');
  assert(isValidAssembly(makeAssembly('DODECAHEDRON', 'DODECAHEDRON')), 'fold4 accepted for a real DODECAHEDRON self-attach');
  assert(isValidAssembly(makeAssembly('CUBE', 'CUBE')), 'fold4 accepted for a real CUBE self-attach');

  // fold4 is meaningless on a vertex-kind connection -- there's no shared
  // face plane for the fold to pivot on -- so it must be rejected even
  // between two otherwise-eligible FOURD-capable shapes. Caught at the
  // purely-structural isAssembly/isConnection level already (no node
  // lookup needed), so check that directly rather than only the
  // cross-referencing isValidAssembly above.
  const vertexKindAssembly: Assembly = {
    nodes: [
      { id: 'a', shape: 'DODECAHEDRON', transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] } },
      { id: 'b', shape: 'DODECAHEDRON', transform: { position: [1, 0, 0], quaternion: [0, 0, 0, 1] } },
    ],
    connections: [{ nodeA: 'a', vertexA: 0, nodeB: 'b', vertexB: 0, kind: 'vertex', fold4: true }],
  };
  assert(!isValidAssembly(vertexKindAssembly), 'fold4 rejected on a vertex-kind connection (no shared face plane to fold around)');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
