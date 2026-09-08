/**
 * Stage 7's D10<->D12 rewrite rule: when a node's shape changes, each of its
 * existing connections needs a vertex on the *new* shape that plays "roughly
 * the same role" as the vertex it used on the old shape. Both shapes are
 * centered at their own centroid, so a vertex's position doubles as its
 * outward direction — "same role" is approximated as "most similar outward
 * direction," matched 1:1 by a greedy best-score-first assignment. A ref
 * whose only candidates are below the threshold, or whose candidates all
 * lost the greedy race to a better-scoring ref, is left unmatched —
 * orphaned rather than guessed.
 */

import { DELTAHEDRA } from './deltahedra';

// "Roughly" — chosen so that surviving directions must land in the same
// rough hemisphere-facing region as the original vertex, not merely on the
// same *side* of the shape. Cross-checked empirically for D10<->D12 in
// scripts/verify-rewrite.ts.
const MATCH_COS_THRESHOLD = 0.5; // within 60 degrees

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Matches each entry of `oldVertexIndices` (vertex indices on `oldSpecId`) to
 * a distinct vertex index on `newSpecId`, by greedy best-direction-similarity
 * first. Returns an array the same length/order as `oldVertexIndices`;
 * `undefined` at a position means that old vertex has no valid new vertex
 * (orphaned).
 */
export function matchRewriteVertices(
  oldSpecId: string,
  newSpecId: string,
  oldVertexIndices: number[],
): (number | undefined)[] {
  const oldSpec = DELTAHEDRA[oldSpecId];
  const newSpec = DELTAHEDRA[newSpecId];

  const oldDirs = oldVertexIndices.map((idx) => normalize(oldSpec.vertices[idx]));
  const newDirs = newSpec.vertices.map((v) => normalize(v));

  const candidates: { i: number; j: number; score: number }[] = [];
  oldDirs.forEach((oldDir, i) => {
    newDirs.forEach((newDir, j) => {
      const score = dot(oldDir, newDir);
      if (score >= MATCH_COS_THRESHOLD) candidates.push({ i, j, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);

  const result: (number | undefined)[] = oldVertexIndices.map(() => undefined);
  const usedOld = new Set<number>();
  const usedNew = new Set<number>();
  for (const c of candidates) {
    if (usedOld.has(c.i) || usedNew.has(c.j)) continue;
    result[c.i] = c.j;
    usedOld.add(c.i);
    usedNew.add(c.j);
  }
  return result;
}

/** The rewrite is only defined for this specific pair — not a generic "swap any shape." */
export const REWRITE_TARGET: Record<string, string> = { D10: 'D12', D12: 'D10' };
