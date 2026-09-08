import { DELTAHEDRA } from '../app/lib/polyhedra/deltahedra';
import { matchRewriteVertices } from '../app/lib/polyhedra/rewrite';

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}
function dot(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

const MATCH_COS_THRESHOLD = 0.5;
let failures = 0;

for (const [fromId, toId] of [
  ['D10', 'D12'],
  ['D12', 'D10'],
] as const) {
  const fromSpec = DELTAHEDRA[fromId];
  const toSpec = DELTAHEDRA[toId];
  const allIndices = fromSpec.vertices.map((_, i) => i);

  console.log(`\n${fromId} -> ${toId}: best single-vertex match quality (sanity check on threshold)`);
  for (const i of allIndices) {
    const dirA = normalize(fromSpec.vertices[i]);
    let best = -Infinity;
    for (const v of toSpec.vertices) best = Math.max(best, dot(dirA, normalize(v)));
    const degrees = (Math.acos(Math.min(1, Math.max(-1, best))) * 180) / Math.PI;
    const flag = best < MATCH_COS_THRESHOLD ? '  <- below threshold, would always orphan' : '';
    console.log(`  vertex ${i}: best cos = ${best.toFixed(3)} (${degrees.toFixed(1)}°)${flag}`);
  }

  // The build plan's own "Done when" scenario: a node with 2 attached
  // neighbors. Vertices 0 and 1 stand in for "whichever two happened to be used".
  const twoRefs = [0, 1];
  const twoMatches = matchRewriteVertices(fromId, toId, twoRefs);
  console.log(`${fromId} -> ${toId} with 2 attachments (vertices 0,1):`, twoMatches);

  // Injectivity: two different old vertices never map to the same new vertex.
  const allMatches = matchRewriteVertices(fromId, toId, allIndices);
  const used = allMatches.filter((m): m is number => m !== undefined);
  if (new Set(used).size !== used.length) {
    failures++;
    console.log(`FAIL ${fromId} -> ${toId}: matching is not injective`, allMatches);
  }

  // Every reported match must actually clear the threshold.
  allIndices.forEach((oldIdx, i) => {
    const newIdx = allMatches[i];
    if (newIdx === undefined) return;
    const score = dot(normalize(fromSpec.vertices[oldIdx]), normalize(toSpec.vertices[newIdx]));
    if (score < MATCH_COS_THRESHOLD - 1e-9) {
      failures++;
      console.log(`FAIL ${fromId} -> ${toId}: vertex ${oldIdx} -> ${newIdx} scored ${score.toFixed(3)}, below threshold`);
    }
  });
}

console.log(`\n${failures} failures.`);
if (failures > 0) process.exit(1);
