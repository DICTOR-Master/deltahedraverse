import { FAMILY_ORDER, FAMILY_META, familyIds, familiesFor } from '../app/lib/polyhedra/families';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

FAMILY_ORDER.forEach((f) => console.log(f, FAMILY_META[f].symbol, familyIds(f).length));

assert(familyIds('DELTAHEDRA').length === 8, 'Deltahedra has 8 members');
assert(familyIds('PLATONIC').length === 5, 'Platonic has 5 members (2 additions + D4/D8/D20)');
assert(familyIds('JOHNSON').length === 92, 'Johnson has all 92 canonical members (87 dedicated + D6/D10/D12/D14/D16)');
assert(familyIds('PRISMS').length === 8, 'Prisms has 8 members (7 dedicated + CUBE)');
assert(familyIds('ANTIPRISMS').length === 8, 'Antiprisms has 8 members (7 dedicated + D8)');

const d8 = familiesFor('D8');
assert(
  d8.includes('DELTAHEDRA') && d8.includes('PLATONIC') && d8.includes('ANTIPRISMS'),
  'D8 (octahedron) belongs to Deltahedra, Platonic, and Antiprisms: ' + JSON.stringify(d8),
);
const cube = familiesFor('CUBE');
assert(
  cube.includes('PLATONIC') && cube.includes('PRISMS'),
  'CUBE belongs to Platonic and Prisms: ' + JSON.stringify(cube),
);
const d4 = familiesFor('D4');
assert(
  d4.includes('DELTAHEDRA') && d4.includes('PLATONIC'),
  'D4 (tetrahedron) belongs to Deltahedra and Platonic: ' + JSON.stringify(d4),
);

const intersection = familyIds('DELTAHEDRA').filter((id) => familiesFor(id).includes('PLATONIC'));
assert(
  intersection.length === 3 && intersection.includes('D4') && intersection.includes('D8') && intersection.includes('D20'),
  'Deltahedra ∩ Platonic = exactly {D4, D8, D20}: ' + JSON.stringify(intersection),
);

const deltaJohnson = familyIds('DELTAHEDRA').filter((id) => familiesFor(id).includes('JOHNSON'));
assert(
  deltaJohnson.length === 5 && ['D6', 'D10', 'D12', 'D14', 'D16'].every((id) => deltaJohnson.includes(id)),
  'Deltahedra ∩ Johnson = exactly {D6, D10, D12, D14, D16} (J12/J13/J84/J51/J17 respectively): ' + JSON.stringify(deltaJohnson),
);

// 4D extension, Stage B: FOURD's own membership is computed (fourD.ts),
// not hand-curated -- assert it matches the real, known classification
// (verify-4d-closure.ts owns the deeper math check; this just confirms
// the family layer wires it through correctly) and that each member
// keeps its original family too, not replaced by FOURD.
const fourD = familyIds('FOURD');
assert(
  fourD.length === 4 && ['D4', 'D8', 'CUBE', 'DODECAHEDRON'].every((id) => fourD.includes(id)),
  'FOURD = exactly {D4, D8, CUBE, DODECAHEDRON}: ' + JSON.stringify(fourD),
);
assert(
  familiesFor('D4').includes('DELTAHEDRA') && familiesFor('D4').includes('PLATONIC') && familiesFor('D4').includes('FOURD'),
  'D4 keeps Deltahedra AND Platonic AND gains FOURD: ' + JSON.stringify(familiesFor('D4')),
);
assert(
  familiesFor('CUBE').includes('PLATONIC') && familiesFor('CUBE').includes('PRISMS') && familiesFor('CUBE').includes('FOURD'),
  'CUBE keeps Platonic AND Prisms AND gains FOURD: ' + JSON.stringify(familiesFor('CUBE')),
);

// Every id appears in exactly one family list, EXCEPT the 10 documented
// overlaps -- DODECAHEDRON is new here (Platonic + FOURD, the 4D
// extension's own computed cross-cutting family); D4/D8/CUBE already
// overlapped before FOURD existed and simply gain one more membership.
const OVERLAP_IDS = new Set(['D4', 'D8', 'D20', 'CUBE', 'D6', 'D10', 'D12', 'D14', 'D16', 'DODECAHEDRON']);
const counts = new Map<string, number>();
FAMILY_ORDER.forEach((f) => familyIds(f).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));
let unexpectedMultiMembership = 0;
counts.forEach((count, id) => {
  if (count > 1 && !OVERLAP_IDS.has(id)) {
    unexpectedMultiMembership++;
    console.error('Unexpected multi-family id:', id, count);
  }
});
assert(unexpectedMultiMembership === 0, 'no undocumented multi-family memberships');

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
