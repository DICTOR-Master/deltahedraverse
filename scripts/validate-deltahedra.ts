import { DELTAHEDRA, DELTAHEDRON_IDS, validateShape } from '../app/lib/deltahedra';

let failed = false;
for (const id of DELTAHEDRON_IDS) {
  const problems = validateShape(DELTAHEDRA[id]);
  if (problems.length === 0) {
    console.log(`${id}: OK`);
  } else {
    failed = true;
    console.log(`${id}: FAILED`);
    for (const p of problems) console.log(`  ${p}`);
  }
}
if (failed) process.exit(1);
