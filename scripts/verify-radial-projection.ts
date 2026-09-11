/**
 * Verifies app/lib/polyhedra/radialProjection.ts's generic engine against
 * the counts/degrees/theta values independently derived and verified via
 * bespoke, well-known coordinate constructions this session (hypercube,
 * cross-polytope, rectified-16-cell, 600-cell duality). Running the
 * SAME generic code path on the app's own real, normalized
 * PolyhedronSpec data (not a bespoke global coordinate system) for all
 * 4 FOURD_CAPABLE shapes is the actual point of this check — it proves
 * the engine is genuinely generic, not four different bespoke
 * embeddings hidden behind one shared function signature.
 */
import { POLYHEDRA } from '../app/lib/polyhedra';
import { FOURD_CAPABLE_IDS } from '../app/lib/polyhedra/fourD';
import {
  buildCellComplex,
  cellVertices,
  dualize,
  dot4,
  bisectingMirror,
  reflectionMatrix,
  matVec,
  FOUR_D_SHAPE_PARAMS,
  projectVec4ToVec3,
  type Vec4,
} from '../app/lib/polyhedra/radialProjection';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}
function near(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) < tol;
}

// (0) bisectingMirror sanity: the exact hand-derived tesseract check --
// reflecting (0,0,0,1) across the mirror bisecting it and (1,0,0,0) by
// 90deg must give exactly (1,0,0,0).
{
  const n: Vec4 = [0, 0, 0, 1];
  const f: Vec4 = [1, 0, 0, 0];
  const m = bisectingMirror(n, f, Math.PI / 2);
  const result = matVec(reflectionMatrix(m), n);
  assert(
    result.every((c, i) => near(c, f[i])),
    `bisectingMirror(90deg) reflects (0,0,0,1) -> (1,0,0,0) exactly, got [${result.map((c) => c.toFixed(6))}]`,
  );
}

// (1) FOURD_CAPABLE_IDS must be exactly the 4 shapes this engine supports.
assert(
  new Set(FOURD_CAPABLE_IDS).size === 4 && Object.keys(FOUR_D_SHAPE_PARAMS).every((id) => FOURD_CAPABLE_IDS.includes(id)),
  `FOUR_D_SHAPE_PARAMS covers exactly FOURD_CAPABLE_IDS, got FOURD_CAPABLE_IDS=${FOURD_CAPABLE_IDS}, params=${Object.keys(FOUR_D_SHAPE_PARAMS)}`,
);

// (2) For each of the 4 real seeds, the GENERIC engine (on the app's own
// real vertex/face data) must reproduce the already-verified cell count
// and per-cell adjacency degree.
for (const [id, params] of Object.entries(FOUR_D_SHAPE_PARAMS)) {
  const spec = POLYHEDRA[id];
  const complex = buildCellComplex(spec);
  assert(complex.cells.length === params.cellCount, `${id}: cell count = ${complex.cells.length}, expected ${params.cellCount}`);

  const degree = new Array(complex.cells.length).fill(0);
  for (const [a, b] of complex.adjacency) {
    degree[a]++;
    degree[b]++;
  }
  assert(
    degree.every((d) => d === params.adjacencyDegree),
    `${id}: every cell has degree ${params.adjacencyDegree}, got degrees ${[...new Set(degree)]}`,
  );
  const expectedPairs = (params.cellCount * params.adjacencyDegree) / 2;
  assert(complex.adjacency.length === expectedPairs, `${id}: expected ${expectedPairs} adjacent pairs, got ${complex.adjacency.length}`);

  // theta re-measured directly from the generated cells' own normals for
  // a real adjacent pair, not just trusted from the input parameter.
  const [a, b] = complex.adjacency[0];
  const measuredTheta = (Math.acos(Math.min(1, Math.max(-1, dot4(complex.cells[a].normal, complex.cells[b].normal)))) * 180) / Math.PI;
  assert(near(measuredTheta, params.thetaDeg, 1e-4), `${id}: measured theta = ${measuredTheta}, expected ${params.thetaDeg}`);

  // Every cell's own transform must be a genuine rotation (orthogonal):
  // its own embedded vertices must be pairwise-congruent to the seed's
  // own embedding (same distances) -- i.e. every cell is an undistorted
  // isometric copy of the seed, not a skewed one.
  const seedDists: number[] = [];
  for (let i = 0; i < complex.seedEmbedding.length; i++) {
    for (let j = i + 1; j < complex.seedEmbedding.length; j++) {
      const d = complex.seedEmbedding[i];
      const e = complex.seedEmbedding[j];
      seedDists.push(Math.hypot(d[0] - e[0], d[1] - e[1], d[2] - e[2], d[3] - e[3]));
    }
  }
  let worstCellDistortion = 0;
  for (const cell of complex.cells) {
    const verts = cellVertices(complex, cell);
    let k = 0;
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = verts[i];
        const e = verts[j];
        const dist = Math.hypot(d[0] - e[0], d[1] - e[1], d[2] - e[2], d[3] - e[3]);
        worstCellDistortion = Math.max(worstCellDistortion, Math.abs(dist - seedDists[k]));
        k++;
      }
    }
  }
  assert(worstCellDistortion < 1e-6, `${id}: every cell is an undistorted isometric copy of the seed (worst distortion=${worstCellDistortion})`);

  // For an adjacent pair, the two cells must literally share a face --
  // at least `size` embedded vertices in common (the shared face's own
  // vertex count), not just an adjacency-graph claim with no geometric
  // backing.
  const [ca, cb, viaFace] = complex.adjacency[0];
  const vertsA = cellVertices(complex, complex.cells[ca]);
  const vertsB = cellVertices(complex, complex.cells[cb]);
  const keyOf = (v: Vec4) => v.map((c) => Math.round(c * 1e5) / 1e5).join(',');
  const keysB = new Set(vertsB.map(keyOf));
  const sharedCount = vertsA.filter((v) => keysB.has(keyOf(v))).length;
  const faceSize = spec.faces[viaFace].length;
  assert(sharedCount === faceSize, `${id}: adjacent cells literally share ${sharedCount} embedded vertices, expected the shared face's own size ${faceSize}`);
}

// (3) Projection guard: a cell with w approaching the view distance
// must not produce NaN/Infinity, and must be pushed no closer than the
// defined minimum denominator.
{
  const v: Vec4 = [1, 2, 3, 4.999];
  const projected = projectVec4ToVec3(v, 5);
  assert(projected.every((c) => Number.isFinite(c)), `projection stays finite even as w approaches the view distance, got [${projected}]`);
}
{
  const v: Vec4 = [1, 2, 3, 5]; // w exactly AT the view distance -- the literal blowup case
  const projected = projectVec4ToVec3(v, 5);
  assert(projected.every((c) => Number.isFinite(c)), `projection stays finite even when w equals the view distance exactly, got [${projected}]`);
}

// (4) Stage 6: dualize() on the real Stage-1-engine 120-cell output
// (built from a dodecahedron seed via reflections, not the bespoke
// 600-cell quaternion construction used earlier this session) must
// reproduce the known 600-cell combinatorics exactly: 600 cells, each a
// genuine regular tetrahedron (4 vertices, all 6 pairwise distances
// equal), degree 4, and 1200 adjacent pairs (matching the 120-cell's
// own known edge count -- duality's "original edges become the dual's
// adjacency" relationship, checked here rather than assumed).
{
  const complex120 = buildCellComplex(POLYHEDRA.DODECAHEDRON);
  const dual = dualize(complex120);
  assert(dual.cells.length === 600, `dualize(120-cell): 600 dual cells, got ${dual.cells.length}`);
  assert(dual.cells.every((c) => c.vertices.length === 4), `dualize(120-cell): every dual cell has exactly 4 vertices (tetrahedron), counts: ${[...new Set(dual.cells.map((c) => c.vertices.length))]}`);

  let worstTetraSpread = 0;
  for (const cell of dual.cells) {
    const dists: number[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const a = cell.vertices[i];
        const b = cell.vertices[j];
        dists.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]));
      }
    }
    const spread = Math.max(...dists) - Math.min(...dists);
    worstTetraSpread = Math.max(worstTetraSpread, spread);
  }
  assert(worstTetraSpread < 1e-6, `dualize(120-cell): every dual cell is a genuine REGULAR tetrahedron (worst edge-length spread=${worstTetraSpread})`);

  const degree = new Array(dual.cells.length).fill(0);
  for (const [a, b] of dual.adjacency) {
    degree[a]++;
    degree[b]++;
  }
  assert(degree.every((d) => d === 4), `dualize(120-cell): every dual cell has degree 4, got degrees ${[...new Set(degree)]}`);
  assert(dual.adjacency.length === 1200, `dualize(120-cell): 1200 adjacent pairs (matching the 120-cell's own known edge count), got ${dual.adjacency.length}`);

  // Radii check: a genuine dual polytope's vertices (the original
  // cells' centroids) should all be equidistant from the origin --
  // checked, not assumed, exactly as this session's own 120-cell spike found.
  const radii = dual.cells.flatMap((c) => c.vertices.map((v) => Math.hypot(v[0], v[1], v[2], v[3])));
  const radiusSpread = Math.max(...radii) - Math.min(...radii);
  assert(radiusSpread < 1e-6, `dualize(120-cell): all 600 dual vertices (original cell centroids) are equidistant from the origin (spread=${radiusSpread})`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
