import { PRISM_ANTIPRISM_ADDITIONS, PRISM_ANTIPRISM_ADDITION_IDS } from '../app/lib/polyhedra/prisms';
import { validateShape } from '../app/lib/polyhedra/core';

let failed = false;
for (const id of PRISM_ANTIPRISM_ADDITION_IDS) {
  const problems = validateShape(PRISM_ANTIPRISM_ADDITIONS[id]);
  if (problems.length === 0) {
    console.log(`${id}: OK`);
  } else {
    failed = true;
    console.log(`${id}: FAILED`);
    for (const p of problems) console.log(`  ${p}`);
  }
}
if (failed) process.exit(1);
