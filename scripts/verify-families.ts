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

// Every id appears in exactly one family list, EXCEPT the 5 documented overlaps.
const OVERLAP_IDS = new Set(['D4', 'D8', 'D20', 'CUBE']);
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
