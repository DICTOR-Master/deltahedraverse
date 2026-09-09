import { filteredIds, countWith, EMPTY_FILTERS, allFaceShapeSizes } from '../app/lib/polyhedra/search';

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

const zeroCombo = countWith(EMPTY_FILTERS, { families: ['DELTAHEDRA', 'JOHNSON'] });
assert(zeroCombo === 0, 'Deltahedra+Johnson together = 0 results (no documented overlap), got ' + zeroCombo);

const triangleOnly = filteredIds({ ...EMPTY_FILTERS, faceShapes: [3] });
assert(triangleOnly.length > 8, 'face-shape=triangle is a broad OR across families, got ' + triangleOnly.length);

const nameSearch = filteredIds({ ...EMPTY_FILTERS, query: 'octahedron' });
assert(nameSearch.includes('D8'), 'name search finds octahedron (D8)');

assert(allFaceShapeSizes()[0] === 3, 'smallest face shape present is a triangle (3)');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
