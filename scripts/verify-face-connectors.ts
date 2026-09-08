import { POLYHEDRA, POLYHEDRON_IDS } from '../app/lib/polyhedra';
import { buildFaceConnectors, dist } from '../app/lib/polyhedra/core';

let checks = 0;
let failures = 0;

function fail(msg: string) {
  failures++;
  console.log(`FAIL: ${msg}`);
}

const sizesBySpec: Record<string, Set<number>> = {};

for (const id of POLYHEDRON_IDS) {
  const spec = POLYHEDRA[id];
  const faceConnectors = buildFaceConnectors(spec);
  sizesBySpec[id] = new Set(faceConnectors.map((f) => f.size));

  checks++;
  if (faceConnectors.length !== spec.faces.length) {
    fail(`${id}: buildFaceConnectors returned ${faceConnectors.length}, expected ${spec.faces.length}`);
  }

  for (const fc of faceConnectors) {
    checks++;
    const len = Math.hypot(...fc.normal);
    if (Math.abs(len - 1) > 1e-9) fail(`${id} face ${fc.faceIndex}: normal not unit length (${len})`);

    // For a convex shape centered at the origin, every face's outward
    // normal must point away from the origin -- i.e. the face centroid and
    // its own outward normal are on the same side. A negative dot product
    // here means the face is wound backwards (inward-pointing normal).
    checks++;
    const outwardness = fc.pos[0] * fc.normal[0] + fc.pos[1] * fc.normal[1] + fc.pos[2] * fc.normal[2];
    if (outwardness <= 0) {
      fail(`${id} face ${fc.faceIndex}: normal points inward (dot(centroid, normal) = ${outwardness.toFixed(6)})`);
    }

    // Centroid should be the true average of the face's own vertices --
    // redundant with the implementation, but cheap and catches a copy-paste
    // mistake in a future refactor.
    checks++;
    const face = spec.faces[fc.faceIndex];
    const pts = face.map((i) => spec.vertices[i]);
    const recomputed = pts.reduce(
      (acc, p) => [acc[0] + p[0] / pts.length, acc[1] + p[1] / pts.length, acc[2] + p[2] / pts.length],
      [0, 0, 0],
    );
    const centroidError = dist(fc.pos, recomputed as [number, number, number]);
    if (centroidError > 1e-9) fail(`${id} face ${fc.faceIndex}: centroid mismatch (${centroidError})`);
  }
}

console.log('\nFace sizes present per shape:');
for (const id of POLYHEDRON_IDS) {
  console.log(`  ${id}: {${[...sizesBySpec[id]].sort().join(', ')}}`);
}

console.log('\nShapes sharing a face size (face-attach compatibility groups):');
const bySizeGroups = new Map<number, string[]>();
for (const id of POLYHEDRON_IDS) {
  for (const size of sizesBySpec[id]) {
    if (!bySizeGroups.has(size)) bySizeGroups.set(size, []);
    bySizeGroups.get(size)!.push(id);
  }
}
for (const [size, ids] of [...bySizeGroups.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${size}-gon: ${ids.join(', ')}`);
}

console.log(`\n${checks} checks, ${failures} failures.`);
if (failures > 0) process.exit(1);
