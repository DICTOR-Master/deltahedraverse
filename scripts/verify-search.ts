import { filteredIds, EMPTY_FILTERS, allFaceShapeSizes } from '../app/lib/polyhedra/search';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

const intersection = filteredIds({ ...EMPTY_FILTERS, families: ['DELTAHEDRA', 'PLATONIC'] });
assert(intersection.length === 3, 'Deltahedra+Platonic together = 3 results, got ' + intersection.length);
assert(
  ['D4', 'D8', 'D20'].every((id) => intersection.includes(id)),
  'intersection is exactly {D4,D8,D20}: ' + JSON.stringify(intersection),
);

// D6/D10/D12/D14/D16 are the 5 strictly-convex deltahedra that are also
// canonically numbered Johnson solids (J12/J13/J84/J51/J17) -- see
// families.ts's EXTRA_MEMBERSHIP. This combo should find exactly them,
// searchable/filterable under either family, not zero (that was the bug
// this same combo caught before the overlap was documented).
const deltaJohnsonCombo = filteredIds({ ...EMPTY_FILTERS, families: ['DELTAHEDRA', 'JOHNSON'] });
assert(deltaJohnsonCombo.length === 5, 'Deltahedra+Johnson together = 5 results, got ' + deltaJohnsonCombo.length);
assert(
  ['D6', 'D10', 'D12', 'D14', 'D16'].every((id) => deltaJohnsonCombo.includes(id)),
  'intersection is exactly {D6,D10,D12,D14,D16}: ' + JSON.stringify(deltaJohnsonCombo),
);

const triangleOnly = filteredIds({ ...EMPTY_FILTERS, faceShapes: [3] });
assert(triangleOnly.length > 8, 'face-shape=triangle is a broad OR across families, got ' + triangleOnly.length);

const nameSearch = filteredIds({ ...EMPTY_FILTERS, query: 'octahedron' });
assert(nameSearch.includes('D8'), 'name search finds octahedron (D8)');

assert(allFaceShapeSizes()[0] === 3, 'smallest face shape present is a triangle (3)');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
