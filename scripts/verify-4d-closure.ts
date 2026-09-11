import { POLYHEDRA } from '../app/lib/polyhedra/index';
import { closureClass, dihedralAngleDeg, FOURD_CAPABLE_IDS } from '../app/lib/polyhedra/fourD';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

function kindsOf(id: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const c of closureClass(POLYHEDRA[id])) out[c.k] = c.kind;
  return out;
}

// Real, known ground truth for the six regular convex 4-polytopes with
// Platonic-solid cells -- not just internal self-consistency. Each of
// these k/kind pairs corresponds to an actual named 4-polytope:
// D4 k=3 -> 5-cell, k=4 -> 16-cell, k=5 -> 600-cell (tetrahedra are cells
// of three of the six regular 4-polytopes); CUBE k=3 -> tesseract, k=4 ->
// ordinary cubic honeycomb (flat, not 4D); D8 k=3 -> 24-cell;
// DODECAHEDRON k=3 -> 120-cell; D20 (icosahedron) is a cell of NONE of
// the six -- its dihedral angle is too wide for even k=3 to close.

const d4 = kindsOf('D4');
assert(d4[3] === '4d' && d4[4] === '4d' && d4[5] === '4d', `D4 (tetrahedron) k=3/4/5 all '4d': ${JSON.stringify(d4)}`);
assert(d4[6] === 'non-closing', `D4 k=6 is 'non-closing': ${JSON.stringify(d4)}`);

const cube = kindsOf('CUBE');
assert(cube[3] === '4d', `CUBE k=3 is '4d' (tesseract): ${JSON.stringify(cube)}`);
assert(cube[4] === 'flat-tiles', `CUBE k=4 is 'flat-tiles' (cubic honeycomb, not 4D): ${JSON.stringify(cube)}`);
assert(cube[5] === 'non-closing', `CUBE k=5 is 'non-closing': ${JSON.stringify(cube)}`);

const d8 = kindsOf('D8');
assert(d8[3] === '4d', `D8 (octahedron) k=3 is '4d' (24-cell): ${JSON.stringify(d8)}`);
assert(d8[4] === 'non-closing', `D8 k=4 is 'non-closing': ${JSON.stringify(d8)}`);
assert(Object.keys(d8).filter((k) => d8[Number(k)] === '4d').length === 1, `D8 has exactly one '4d' k: ${JSON.stringify(d8)}`);

const dodeca = kindsOf('DODECAHEDRON');
assert(dodeca[3] === '4d', `DODECAHEDRON k=3 is '4d' (120-cell): ${JSON.stringify(dodeca)}`);
const dodecaDefect = closureClass(POLYHEDRA.DODECAHEDRON).find((c) => c.k === 3)!.defectDeg;
assert(Math.abs(dodecaDefect - 10.3) < 0.1, `DODECAHEDRON k=3 defectDeg ~= 10.3: got ${dodecaDefect.toFixed(3)}`);

const d20 = closureClass(POLYHEDRA.D20);
assert(!d20.some((c) => c.kind === '4d'), `D20 (icosahedron) has NO '4d' options at all: ${JSON.stringify(d20)}`);

// Dihedral angle sanity checks against well-known real values.
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) < tol;
assert(near(dihedralAngleDeg(POLYHEDRA.CUBE)!, 90), `CUBE dihedral angle ~= 90deg: got ${dihedralAngleDeg(POLYHEDRA.CUBE)}`);
assert(near(dihedralAngleDeg(POLYHEDRA.D4)!, 70.53), `D4 dihedral angle ~= 70.53deg: got ${dihedralAngleDeg(POLYHEDRA.D4)}`);
assert(near(dihedralAngleDeg(POLYHEDRA.D8)!, 109.47), `D8 dihedral angle ~= 109.47deg: got ${dihedralAngleDeg(POLYHEDRA.D8)}`);
assert(near(dihedralAngleDeg(POLYHEDRA.DODECAHEDRON)!, 116.57, 0.01), `DODECAHEDRON dihedral angle ~= 116.57deg: got ${dihedralAngleDeg(POLYHEDRA.DODECAHEDRON)}`);
assert(near(dihedralAngleDeg(POLYHEDRA.D20)!, 138.19, 0.01), `D20 dihedral angle ~= 138.19deg: got ${dihedralAngleDeg(POLYHEDRA.D20)}`);

// The real, current registry: exactly these 4 shapes are 4D-capable,
// nothing more and nothing less -- computed against the live registry,
// not a hand-typed expectation of what it "should" contain.
const expected = new Set(['D4', 'CUBE', 'D8', 'DODECAHEDRON']);
const actual = new Set(FOURD_CAPABLE_IDS);
assert(
  actual.size === expected.size && [...expected].every((id) => actual.has(id)),
  `FOURD_CAPABLE_IDS is exactly {D4, CUBE, D8, DODECAHEDRON}: got ${JSON.stringify(FOURD_CAPABLE_IDS)}`,
);

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
