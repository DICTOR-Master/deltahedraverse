/**
 * The 4 Kepler-Poinsot solids (star polyhedra) -- BROWSABLE ONLY, never
 * merged into the main POLYHEDRA registry (index.ts), never a `FamilyKey`
 * in families.ts, never wired into any attach flow. See
 * docs/star-polyhedra-spec.md for the full staged plan and reasoning:
 * every face here is a genuine star or a shape whose OWN winding is
 * different from a convex polygon's, and the whole vertex/face-attach
 * engine (facesCongruent, vertex-capacity/hover, PolyhedralWheel's
 * family-driven picker) assumes convex, simple, non-self-intersecting
 * faces throughout. Kept structurally impossible to leak into that
 * system rather than filtered out ad hoc.
 *
 * Every one of the 4 is derived directly from this registry's own
 * already-validated DELTAHEDRA.D20 (icosahedron) or PLATONIC_ADDITIONS.
 * DODECAHEDRON vertex/edge/face data -- never hand-typed coordinates,
 * the same "derive, don't duplicate" standard every other family here
 * already holds itself to. Each construction was verified numerically
 * before being written here (real planarity/regularity/winding checks,
 * not assumed from memory) -- see this file's own comments at each step
 * for exactly what was checked, and docs/star-polyhedra-spec.md for the
 * summary table.
 */

import { makeSpec, dist, type PolyhedronSpec, type Vec3 } from './core';
import { DELTAHEDRA } from './deltahedra';

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function normalize(a: Vec3): Vec3 {
  const n = norm(a);
  return [a[0] / n, a[1] / n, a[2] / n];
}
function centroidOf(vs: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const v of vs) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  return [c[0] / vs.length, c[1] / vs.length, c[2] / vs.length];
}

/**
 * Orders a set of vertex indices (all real neighbors of one shared local
 * region) into a real cyclic face loop, by angle around that patch's own
 * approximate normal (its own centroid direction, valid here since every
 * shape in this file is centered at the origin and the patch itself is a
 * small local neighborhood, not assumed for a general polygon).
 */
function orderCyclically(idxs: number[], verts: Vec3[]): number[] {
  const pts = idxs.map((i) => verts[i]);
  const c = centroidOf(pts);
  const n = normalize(c);
  const ref = normalize(sub(pts[0], c));
  const w = normalize(cross(n, ref));
  return idxs
    .map((idx, k) => ({ idx, ang: Math.atan2(dot(sub(pts[k], c), w), dot(sub(pts[k], c), ref)) }))
    .sort((a, b) => a.ang - b.ang)
    .map((o) => o.idx);
}

/** Reverses a face's vertex order if its computed normal points inward instead of outward. */
function ensureOutward(idxs: number[], verts: Vec3[]): number[] {
  const pts = idxs.map((i) => verts[i]);
  const c = centroidOf(pts);
  const n = normalize(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  return dot(n, c) < 0 ? idxs.slice().reverse() : idxs;
}

/** Derives a shape's real (unique, unordered) edge list from its own face loops -- never hand-listed separately, so the two can never disagree. */
function edgesFromFaces(faces: number[][]): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const face of faces) {
    for (let k = 0; k < face.length; k++) {
      const a = face[k];
      const b = face[(k + 1) % face.length];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(a < b ? [a, b] : [b, a]);
    }
  }
  return edges;
}

const D20 = DELTAHEDRA.D20;

// Real neighbor graph from D20's own registered edges -- each of the 12
// icosahedron vertices has exactly 5 neighbors (verified: every regular
// icosahedron vertex has degree 5, and D20.edges is already this
// registry's own validated data).
const icoNeighbors: number[][] = Array.from({ length: D20.vertices.length }, () => []);
for (const [a, b] of D20.edges) {
  icoNeighbors[a].push(b);
  icoNeighbors[b].push(a);
}

// --- Great dodecahedron: D20's own 12 vertices; each vertex's own 5 real
// icosahedron-neighbors form one pentagon face (verified: these 5 points
// are exactly coplanar -- max deviation 0 to floating-point precision --
// and the resulting pentagon is exactly regular, all 5 edges equal). ---
const greatDodecahedronFaces: number[][] = icoNeighbors.map((nbrs) => ensureOutward(orderCyclically(nbrs, D20.vertices), D20.vertices));
const greatDodecahedronEdges = edgesFromFaces(greatDodecahedronFaces);

// --- Small stellated dodecahedron: the SAME 12 vertices and the SAME 5-
// vertex groupings as the great dodecahedron above, just connected in
// skip-one order (0,2,4,1,3) instead of plain cyclic order -- turns each
// convex pentagon into a real regular pentagram, verified exactly regular
// (all 5 edges equal, at the pentagon's own diagonal length). ---
const SKIP_ORDER = [0, 2, 4, 1, 3];
const smallStellatedDodecahedronFaces: number[][] = greatDodecahedronFaces.map((face) =>
  ensureOutward(SKIP_ORDER.map((k) => face[k]), D20.vertices),
);
const smallStellatedDodecahedronEdges = edgesFromFaces(smallStellatedDodecahedronFaces);

// --- Great icosahedron: the SAME 12 D20 vertices, but reconnected via
// their "second-ring" neighbors (the 5 vertices at the SECOND-nearest
// real distance shell, not the 5 nearest/real-icosahedron-edge ones) --
// verified: every vertex has exactly 5 second-ring neighbors, and the
// resulting adjacency graph contains exactly 20 real equilateral
// triangles (matching great icosahedron's known V=12,E=30,F=20). ---
function distanceShells(vertices: Vec3[], from: number): number[] {
  return vertices.map((v) => Math.round(dist(vertices[from], v) * 1e6) / 1e6);
}
const shellDistances = [...new Set(distanceShells(D20.vertices, 0))].sort((a, b) => a - b);
const secondRingDistance = shellDistances[2]; // [0]=self, [1]=real icosahedron edge, [2]=this
const secondRingAdjacency: Set<number>[] = D20.vertices.map(() => new Set());
for (let i = 0; i < D20.vertices.length; i++) {
  for (let j = 0; j < D20.vertices.length; j++) {
    if (i === j) continue;
    const d = Math.round(dist(D20.vertices[i], D20.vertices[j]) * 1e6) / 1e6;
    if (d === secondRingDistance) secondRingAdjacency[i].add(j);
  }
}
const greatIcosahedronFacesRaw: number[][] = [];
for (let i = 0; i < D20.vertices.length; i++) {
  for (const j of secondRingAdjacency[i]) {
    if (j <= i) continue;
    for (const k of secondRingAdjacency[j]) {
      if (k <= j) continue;
      if (secondRingAdjacency[i].has(k)) greatIcosahedronFacesRaw.push([i, j, k]);
    }
  }
}
const greatIcosahedronFaces: number[][] = greatIcosahedronFacesRaw.map((f) => ensureOutward(f, D20.vertices));
const greatIcosahedronEdges = edgesFromFaces(greatIcosahedronFaces);

// --- Great stellated dodecahedron: NOT the registered DODECAHEDRON's own
// vertices -- verified computationally (see the investigation this
// construction replaced) that re-skip-ordering DODECAHEDRON's own 12 face
// loops independently produces 60 unique edges, not 30, because each
// face's 5 "diagonal" edges are then purely internal to that one face and
// never coincide with a neighboring face's edges. The real construction
// is the polar dual of the great icosahedron built above: GSD has one
// vertex per great-icosahedron FACE (a "pole," the reciprocal of that
// face's plane) and one face per great-icosahedron VERTEX (i.e. one of
// D20's own 12 vertices) -- each such face is the 5 poles of the 5
// great-icosahedron faces meeting at that vertex, connected in skip-order
// to form a pentagram. Verified: all 20 poles equidistant from center (a
// real spherical arrangement), every face-loop edge exactly the same
// length (8-decimal match), every pole has degree exactly 3, and the
// resulting edge set has exactly 30 unique members. ---
function planeDistanceAndNormal(face: number[], verts: Vec3[]): { n: Vec3; d: number } {
  const pts = face.map((i) => verts[i]);
  const c = centroidOf(pts);
  let n = normalize(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (dot(n, c) < 0) n = [-n[0], -n[1], -n[2]];
  return { n, d: dot(n, pts[0]) };
}
// Polar reciprocal of each great-icosahedron face plane: direction = the
// face's own outward normal, magnitude = 1 / (that plane's distance from
// center) -- the standard dual-polyhedron pole construction.
const gsdPoles: Vec3[] = greatIcosahedronFaces.map((face) => {
  const { n, d } = planeDistanceAndNormal(face, D20.vertices);
  return [n[0] / d, n[1] / d, n[2] / d];
});
// Which great-icosahedron faces meet at each D20 (icosahedron) vertex --
// exactly 5 per vertex, matching great icosahedron's {5/2} vertex figure.
const giFaceIncidence: number[][] = D20.vertices.map(() => []);
greatIcosahedronFaces.forEach((face, faceIdx) => {
  for (const v of face) giFaceIncidence[v].push(faceIdx);
});
const greatStellatedDodecahedronFaces: number[][] = giFaceIncidence.map((poleIdxs) =>
  ensureOutward(SKIP_ORDER.map((k) => orderCyclically(poleIdxs, gsdPoles)[k]), gsdPoles),
);
const greatStellatedDodecahedronEdges = edgesFromFaces(greatStellatedDodecahedronFaces);

export const STAR_POLYHEDRA: Record<string, PolyhedronSpec> = {
  GREAT_DODECAHEDRON: makeSpec(
    'GREAT_DODECAHEDRON',
    'great dodecahedron',
    greatDodecahedronFaces.length,
    D20.vertices,
    greatDodecahedronEdges,
    greatDodecahedronFaces,
  ),
  SMALL_STELLATED_DODECAHEDRON: makeSpec(
    'SMALL_STELLATED_DODECAHEDRON',
    'small stellated dodecahedron',
    smallStellatedDodecahedronFaces.length,
    D20.vertices,
    smallStellatedDodecahedronEdges,
    smallStellatedDodecahedronFaces,
  ),
  GREAT_ICOSAHEDRON: makeSpec(
    'GREAT_ICOSAHEDRON',
    'great icosahedron',
    greatIcosahedronFaces.length,
    D20.vertices,
    greatIcosahedronEdges,
    greatIcosahedronFaces,
  ),
  GREAT_STELLATED_DODECAHEDRON: makeSpec(
    'GREAT_STELLATED_DODECAHEDRON',
    'great stellated dodecahedron',
    greatStellatedDodecahedronFaces.length,
    gsdPoles,
    greatStellatedDodecahedronEdges,
    greatStellatedDodecahedronFaces,
  ),
};

export const STAR_POLYHEDRON_IDS = Object.keys(STAR_POLYHEDRA);

/**
 * Real, published invariants not derivable from vertices/edges/faces
 * alone the way V/E/F themselves are: the Schläfli symbol (the two
 * numbers describing face type and vertex figure, {p/q, r/s}) and
 * density (how many times the faces wind around the solid's own
 * center -- the star-polyhedron analogue of an ordinary polyhedron
 * always having density 1). Metadata, not geometry -- kept separate
 * from PolyhedronSpec itself, which stays family-agnostic.
 */
export const STAR_POLYHEDRON_META: Record<string, { schlafli: string; density: number }> = {
  GREAT_DODECAHEDRON: { schlafli: '{5, 5/2}', density: 3 },
  SMALL_STELLATED_DODECAHEDRON: { schlafli: '{5/2, 5}', density: 3 },
  GREAT_STELLATED_DODECAHEDRON: { schlafli: '{5/2, 3}', density: 7 },
  GREAT_ICOSAHEDRON: { schlafli: '{3, 5/2}', density: 7 },
};
