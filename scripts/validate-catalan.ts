import { CATALAN_ADDITIONS, CATALAN_ADDITION_IDS } from '../app/lib/polyhedra/catalan';
import { validateCatalanShape } from '../app/lib/polyhedra/core';

let failed = false;
for (const id of CATALAN_ADDITION_IDS) {
  const problems = validateCatalanShape(CATALAN_ADDITIONS[id]);
  if (problems.length === 0) {
    console.log(`${id}: OK`);
  } else {
    failed = true;
    console.log(`${id}: FAILED`);
    for (const p of problems) console.log(`  ${p}`);
  }
}
if (failed) process.exit(1);
