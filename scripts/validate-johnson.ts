import { JOHNSON_ADDITIONS, JOHNSON_ADDITION_IDS } from '../app/lib/polyhedra/johnson';
import { validateShape } from '../app/lib/polyhedra/core';

let failed = false;
for (const id of JOHNSON_ADDITION_IDS) {
  const problems = validateShape(JOHNSON_ADDITIONS[id]);
  if (problems.length === 0) {
    console.log(`${id}: OK`);
  } else {
    failed = true;
    console.log(`${id}: FAILED`);
    for (const p of problems) console.log(`  ${p}`);
  }
}
if (failed) process.exit(1);
