/**
 * 4D Radial Cell Projection — Stage 1's generic engine: a 3D seed cell +
 * a real 4D adjacency rule (hyperplane rotation, not a per-pair 3D
 * rigid-transform patch) + a 4D->3D perspective projection = a genuine
 * 3D representation of a regular 4-polytope. One engine, parameterized
 * per seed shape, not four hardcoded objects.
 *
 * This supersedes the earlier fold4.ts approach for the *general*
 * multi-sibling case: fold4 tried to reconcile per-pair 3D rigid
 * corrections after the fact, which don't compose associatively (see
 * this session's own fold4 investigation — confirmed oscillation for
 * any node with 2+ simultaneous edge-partners). This engine instead
 * builds real 4D coordinates from the start via hyperplane rotations —
 * the literal Wythoff/Coxeter construction used to generate every
 * regular 4-polytope. Rotations in a finite reflection group compose
 * exactly and the orbit is *guaranteed* to close after finitely many
 * steps; there is no iterative numerical correction to oscillate.
 *
 * theta (the cell-to-cell 4D dihedral angle) is NOT derivable from a
 * cell's own 3D dihedral angle by any simple formula — checked
 * directly: the tesseract's own angle-defect (90deg, from fourD.ts's
 * closureClass at k=3) happens to equal its theta (90deg), but the
 * 16-cell's defect (77.9deg, at k=4) does NOT equal its theta (60deg).
 * So FOUR_D_SHAPE_PARAMS below is not a shortcut for something already
 * computed elsewhere — each entry is an independently required,
 * independently verified fact about that specific target 4-polytope's
 * real embedded geometry. Derivation for each (see
 * scripts/verify-radial-projection.ts for the full checks):
 *  - tesseract: the [-1,1]^4 hypercube's 8 facet hyperplanes.
 *  - 16-cell: the +-e_i (i=1..4) cross-polytope's 16 signed-orthant cells.
 *  - 24-cell: rectifying the 16-cell (the cuboctahedron analogy one
 *    dimension up — cuboctahedron = rectified cube = rectified
 *    octahedron; 24-cell = rectified tesseract = rectified 16-cell).
 *  - 120-cell: duality with the 600-cell, whose 120 vertices are the
 *    binary icosahedral group's unit quaternions.
 */

import type { PolyhedronSpec, Vec3 } from './core';
import { buildFaceConnectors } from './core';

export type Vec4 = [number, number, number, number];
export type Mat4x4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

export const IDENTITY4: Mat4x4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

export function matMul(a: Mat4x4, b: Mat4x4): Mat4x4 {
  const result: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i][k] * b[k][j];
      result[i][j] = s;
    }
  }
  return result as Mat4x4;
}

export function matVec(a: Mat4x4, v: Vec4): Vec4 {
  return [0, 1, 2, 3].map((i) => a[i][0] * v[0] + a[i][1] * v[1] + a[i][2] * v[2] + a[i][3] * v[3]) as Vec4;
}

export function dot4(a: Vec4, b: Vec4): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function norm4(a: Vec4): Vec4 {
  const l = Math.sqrt(dot4(a, a));
  return [a[0] / l, a[1] / l, a[2] / l, a[3] / l];
}

/**
 * The mirror direction m such that reflecting n across the hyperplane
 * with normal m sends n exactly to cos(theta)*n + sin(theta)*f, for
 * orthonormal n, f. Derived from reflect(n,m) = n - 2(n.m)m = target,
 * solving for m: m = sin(theta/2)*n - cos(theta/2)*f (verified directly
 * by substitution: n.m = sin(theta/2), so n - 2sin(theta/2)*m expands
 * via the half-angle identities to cos(theta)*n + sin(theta)*f exactly).
 *
 * This MUST be a reflection, not a rotation by theta within the (n,f)
 * plane — the two send n to the same place but differ on f itself (a
 * rotation sends f -> -sin(theta)n+cos(theta)f; this reflection sends
 * f -> sin(theta)n-cos(theta)f), and only the reflection reproduces the
 * real target 4-polytopes. A first version of this engine used the
 * rotation formula instead: it happened to still close correctly for
 * the cube (8 cells) by coincidence of that seed's extra symmetry
 * (every local face normal is itself a signed coordinate axis), but
 * diverged past 200 cells without closing for D4, D8, and DODECAHEDRON
 * — caught directly by scripts/verify-radial-projection.ts rather than
 * assumed correct from the cube case alone. This is exactly the same
 * literal reflection operation validated by hand for cube/16-cell/
 * 24-cell/120-cell earlier this session (mirror = normalize(n0-n1) for
 * a KNOWN target n1) — here solved for m directly from theta instead of
 * needing the target normal already known in advance, so it generalizes
 * to every face of every seed, not just the ones checked by hand.
 */
export function bisectingMirror(n: Vec4, f: Vec4, thetaRad: number): Vec4 {
  const half = thetaRad / 2;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return norm4([s * n[0] - c * f[0], s * n[1] - c * f[1], s * n[2] - c * f[2], s * n[3] - c * f[3]]);
}

/** The 4x4 reflection across the hyperplane with unit normal m: v -> v - 2(v.m)m. */
export function reflectionMatrix(m: Vec4): Mat4x4 {
  const result: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = (i === j ? 1 : 0) - 2 * m[i] * m[j];
    }
  }
  return result as Mat4x4;
}

export interface FourDShapeParams {
  thetaDeg: number;
  cellCount: number;
  adjacencyDegree: number;
}

export const FOUR_D_SHAPE_PARAMS: Record<string, FourDShapeParams> = {
  D4: { thetaDeg: 60, cellCount: 16, adjacencyDegree: 4 }, // tetrahedron -> 16-cell
  CUBE: { thetaDeg: 90, cellCount: 8, adjacencyDegree: 6 }, // cube -> tesseract
  D8: { thetaDeg: 60, cellCount: 24, adjacencyDegree: 8 }, // octahedron -> 24-cell
  DODECAHEDRON: { thetaDeg: 36, cellCount: 120, adjacencyDegree: 12 }, // dodecahedron -> 120-cell
};

export interface FourDCell {
  id: number;
  transform: Mat4x4; // maps the seed's own reference embedding (cell 0) to this cell's actual global position
  normal: Vec4; // this cell's own outward 4D direction; transform applied to (0,0,0,1)
}

export interface FourDCellComplex {
  seedSpecId: string;
  thetaDeg: number;
  seedEmbedding: Vec4[]; // the seed's own vertices embedded for the reference cell (id 0)
  cells: FourDCell[];
  adjacency: [cellIdA: number, cellIdB: number, viaFaceOfA: number][];
}

// No target 4-polytope in FOUR_D_SHAPE_PARAMS exceeds 120 cells -- this
// is a safety cap against a runaway orbit (e.g. a wrong theta that never
// closes), not a tuned limit.
const MAX_CELLS_GUARD = 200;

function normalKey(n: Vec4): string {
  return n.map((c) => Math.round(c * 1e6) / 1e6).join(',');
}

/**
 * Builds the full cell complex for a FOURD_CAPABLE seed shape: starts
 * from one reference cell, and repeatedly generates the neighbor across
 * each free face by REFLECTING the current cell across the hyperplane
 * that bisects its own outward normal and that face's own (globally
 * oriented) local normal, by angle `theta` — the literal Wythoff/Coxeter
 * orbit generation, not a per-pair correction. BFS naturally dedupes
 * cells that are reached more than once (closure), verified in
 * scripts/verify-radial-projection.ts to terminate at exactly the known
 * cell count for all 4 seeds.
 */
export function buildCellComplex(spec: PolyhedronSpec, maxCells = MAX_CELLS_GUARD): FourDCellComplex {
  const params = FOUR_D_SHAPE_PARAMS[spec.id];
  if (!params) {
    throw new Error(`${spec.id} has no verified 4D theta -- radial cell projection only supports FOURD_CAPABLE_IDS shapes`);
  }
  const thetaRad = (params.thetaDeg * Math.PI) / 180;

  const faceConnectors = buildFaceConnectors(spec);
  // Regular-solid inradius: distance from center to each face's own
  // plane (dot of the face centroid with its own outward normal, since
  // the shape is already centered) -- must be uniform across every face
  // (checked, not assumed; a non-face-transitive shape would silently
  // produce an invalid embedding otherwise).
  const inradii = faceConnectors.map(
    (fc) => fc.pos[0] * fc.normal[0] + fc.pos[1] * fc.normal[1] + fc.pos[2] * fc.normal[2],
  );
  const inradius = inradii[0];
  if (inradii.some((r) => Math.abs(r - inradius) > 1e-6)) {
    throw new Error(`${spec.id}: not a uniform-inradius solid -- radial cell projection requires face-transitive symmetry`);
  }

  // Reference embedding: the seed's own local vertices lifted to w=0,
  // then translated along the reference normal n0=(0,0,0,1) by
  // `inradius * cot(theta/2)` -- NOT simply the inradius itself. Derived
  // (and checked in scripts/verify-radial-projection.ts) from the
  // requirement that a shared face's own vertices must lie exactly ON
  // the reflecting mirror (so two adjacent cells' copies of that face
  // truly coincide, not just their cells' outward normals being the
  // right angle apart): for a vertex p on face F, p.n = depth and
  // p.fGlobal = inradius always (the latter is a fixed property of the
  // local shape, independent of the chosen depth); solving p.mirror = 0
  // for depth gives depth = inradius / tan(theta/2). This equals the
  // inradius exactly only when theta = 90deg (cube), which is why a
  // first version of this engine -- embedding at plain `inradius` --
  // happened to work for CUBE by coincidence but left a real gap
  // between adjacent D4/D8/DODECAHEDRON cells' shared faces (caught by
  // scripts/verify-radial-projection.ts checking literal shared-vertex
  // coincidence, not just the adjacency-graph degree).
  const n0: Vec4 = [0, 0, 0, 1];
  const depth = inradius / Math.tan(thetaRad / 2);
  const seedEmbedding: Vec4[] = spec.vertices.map((v) => [v[0], v[1], v[2], depth] as Vec4);

  const cells: FourDCell[] = [{ id: 0, transform: IDENTITY4, normal: n0 }];
  const seenNormals = new Map<string, number>([[normalKey(n0), 0]]);
  const seenPairs = new Set<string>();
  const adjacency: [number, number, number][] = [];

  const queue: number[] = [0];
  while (queue.length > 0) {
    const cellId = queue.shift()!;
    const cell = cells[cellId];
    for (const fc of faceConnectors) {
      const fLocal: Vec4 = [fc.normal[0], fc.normal[1], fc.normal[2], 0];
      const fGlobal = norm4(matVec(cell.transform, fLocal));
      const mirror = bisectingMirror(cell.normal, fGlobal, thetaRad);
      const refl = reflectionMatrix(mirror);
      const neighborTransform = matMul(refl, cell.transform);
      const neighborNormal = norm4(matVec(refl, cell.normal));
      const key = normalKey(neighborNormal);
      let neighborId = seenNormals.get(key);
      if (neighborId === undefined) {
        neighborId = cells.length;
        if (neighborId >= maxCells) {
          throw new Error(`${spec.id}: exceeded ${maxCells} cells without closing -- theta or the seed's own face data is likely wrong`);
        }
        seenNormals.set(key, neighborId);
        cells.push({ id: neighborId, transform: neighborTransform, normal: neighborNormal });
        queue.push(neighborId);
      }
      const pairKey = [Math.min(cellId, neighborId), Math.max(cellId, neighborId)].join(':');
      if (!seenPairs.has(pairKey) && cellId !== neighborId) {
        seenPairs.add(pairKey);
        adjacency.push([cellId, neighborId, fc.faceIndex]);
      }
    }
  }

  return { seedSpecId: spec.id, thetaDeg: params.thetaDeg, seedEmbedding, cells, adjacency };
}

// Guards `d - w` away from zero -- the one place the perspective formula
// blows up numerically (a cell whose w approaches the viewpoint
// distance), per Stage 1's own requirement.
const MIN_VIEW_DENOMINATOR = 0.05;

export function projectVec4ToVec3(v: Vec4, viewDistance: number): Vec3 {
  const denom = Math.max(viewDistance - v[3], MIN_VIEW_DENOMINATOR);
  return [v[0] / denom, v[1] / denom, v[2] / denom];
}

/** Every one of a cell's own embedded vertices, in the global 4D frame. */
export function cellVertices(complex: FourDCellComplex, cell: FourDCell): Vec4[] {
  return complex.seedEmbedding.map((v) => matVec(cell.transform, v));
}

export interface RadialProjectionScene {
  viewDistance: number;
  // One entry per cell, in complex.cells order; each is that cell's own
  // vertices (same indexing as spec.vertices / spec.faces, so callers
  // triangulate with the seed's own unchanged face list) already
  // perspective-projected to 3D.
  cellsVertices3D: Vec3[][];
}

/**
 * Stage 7's rendering bridge: builds the full cell complex for `spec`
 * and perspective-projects every cell's vertices to 3D in one pass, per
 * the plan's own formula `(x,y,z,w) -> (x/(d-w), y/(d-w), z/(d-w))`.
 * `viewDistance` is chosen automatically as `maxAbsW * viewMargin` --
 * comfortably past every generated vertex's own w-extent so the
 * near-viewpoint clamp in projectVec4ToVec3 is never the thing doing
 * the work, while still being close enough that outer cells visibly
 * expand under the perspective, matching the plan's own Stage 2 "done
 * when" description.
 */
// 1.6 (barely past the outermost vertex) made the near/far size ratio
// too extreme -- reported live as an anisotropic "sausage" blob rather
// than a legible nested structure. A larger margin is a gentler
// perspective (still the same formula, just farther from the object),
// keeping outer/inner cells within a readable size range.
export function buildRadialProjectionScene(spec: PolyhedronSpec, viewMargin = 5): RadialProjectionScene {
  const complex = buildCellComplex(spec);
  const allVertices = complex.cells.flatMap((cell) => cellVertices(complex, cell));
  const maxAbsW = Math.max(...allVertices.map((v) => Math.abs(v[3])), 1e-6);
  const viewDistance = maxAbsW * viewMargin;
  const cellsVertices3D = complex.cells.map((cell) => cellVertices(complex, cell).map((v) => projectVec4ToVec3(v, viewDistance)));
  return { viewDistance, cellsVertices3D };
}

export interface DualCell {
  id: number;
  vertices: Vec4[]; // this dual cell's own embedded vertices (one per original polytope CELL incident to the corresponding original VERTEX)
  normal: Vec4; // this dual cell's own outward direction -- equal to the corresponding original polytope vertex's own direction
}

export interface DualCellComplex {
  cells: DualCell[];
  adjacency: [number, number][];
}

function keyOf4(v: Vec4): string {
  return v.map((c) => Math.round(c * 1e6) / 1e6).join(',');
}

/**
 * Stage 6: duality, as a real operation on ANY FourDCellComplex, not a
 * 120/600-cell-only special case. Standard polytope duality: k-faces of
 * P correspond to (n-1-k)-faces of its dual with reversed inclusion --
 * here, VERTICES of the original become CELLS of the dual (one dual
 * cell per original vertex, its own vertices being the centroids of
 * every original CELL incident to that vertex), and EDGES of the
 * original become the dual's own cell-ADJACENCY (two dual cells are
 * adjacent exactly when the corresponding original vertices are
 * edge-connected) -- exactly the relationship independently verified by
 * hand this session for 120-cell <-> 600-cell (dodecahedral cells dual
 * to binary-icosahedral quaternions), now implemented generically off
 * of whatever FourDCellComplex buildCellComplex() produces, for any
 * seed. Checked in scripts/verify-radial-projection.ts against the
 * already-known 600-cell combinatorics (120 cells, all regular
 * tetrahedra, degree 4, matching V=120,E=720,F=1200,C=600).
 */
export function dualize(complex: FourDCellComplex): DualCellComplex {
  const vertexIndexByKey = new Map<string, number>();
  const vertexPositions: Vec4[] = [];
  const vertexMembership: number[][] = []; // global vertex index -> [cell ids incident to it]

  for (const cell of complex.cells) {
    const verts = cellVertices(complex, cell);
    for (const v of verts) {
      const key = keyOf4(v);
      let idx = vertexIndexByKey.get(key);
      if (idx === undefined) {
        idx = vertexPositions.length;
        vertexIndexByKey.set(key, idx);
        vertexPositions.push(v);
        vertexMembership.push([]);
      }
      vertexMembership[idx].push(cell.id);
    }
  }

  const cellsById = new Map(complex.cells.map((c) => [c.id, c]));
  const centroidOfCell = (cellId: number): Vec4 => {
    const verts = cellVertices(complex, cellsById.get(cellId)!);
    const sum = verts.reduce((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2], acc[3] + v[3]] as Vec4, [0, 0, 0, 0] as Vec4);
    return [sum[0] / verts.length, sum[1] / verts.length, sum[2] / verts.length, sum[3] / verts.length];
  };

  const dualCells: DualCell[] = vertexPositions.map((vpos, idx) => ({
    id: idx,
    vertices: vertexMembership[idx].map(centroidOfCell),
    normal: norm4(vpos),
  }));

  // Original edges (local edge list applied through every cell's own
  // embedding, deduped globally) become the dual's own adjacency.
  const adjacencySet = new Set<string>();
  const adjacency: [number, number][] = [];
  for (const cell of complex.cells) {
    const verts = cellVertices(complex, cell);
    const localIndexOf = (v: Vec4) => vertexIndexByKey.get(keyOf4(v))!;
    // Recover this cell's own local edges from its seed embedding's
    // relative structure isn't available here (only the embedded
    // points are) -- instead, treat any two vertices at the cell's own
    // minimum pairwise distance as an edge, exactly the same
    // "measure, don't assume" rule used throughout this session's
    // verification scripts.
    let minDist = Infinity;
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2], verts[i][3] - verts[j][3]);
        if (d > 1e-9 && d < minDist) minDist = d;
      }
    }
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2], verts[i][3] - verts[j][3]);
        if (Math.abs(d - minDist) < 1e-6) {
          const gi = localIndexOf(verts[i]);
          const gj = localIndexOf(verts[j]);
          const key = [Math.min(gi, gj), Math.max(gi, gj)].join(':');
          if (!adjacencySet.has(key)) {
            adjacencySet.add(key);
            adjacency.push([gi, gj]);
          }
        }
      }
    }
  }

  return { cells: dualCells, adjacency };
}
