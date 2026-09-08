/**
 * Shared, family-agnostic polyhedron infrastructure. Vertices + edges +
 * faces are the only source of truth for any shape in any family
 * (deltahedra, Platonic, and eventually Archimedean/Johnson) — everything
 * else (connector degree, geometry validation) is derived from them, never
 * hand-declared separately. See docs/construction-kit-spec.md's "derive,
 * don't duplicate" rule for why: an independently-written version of this
 * same kind of data once hand-declared a `degrees` array that disagreed
 * with its own edge list, and a face list with the wrong total count
 * entirely — both the specific bug class that happens when a fact
 * derivable from another field gets stored and asserted separately.
 */

export type Vec3 = [number, number, number];

export interface Connector {
  id: number;
  degree: number; // number of faces (equivalently edges) meeting at this vertex
  pos: Vec3; // local position; shape is centered, so this doubles as the outward direction
}

export interface PolyhedronSpec {
  id: string;
  name: string;
  faceCount: number;
  vertices: Vec3[];
  edges: [number, number][];
  faces: number[][]; // outward-wound (CCW as seen from outside); 3 for deltahedra, larger n-gons for other families
  connectors: Connector[];
}

export interface FaceConnector {
  faceIndex: number;
  size: number; // vertex/edge count bounding this face (3 = triangle, 4 = square, 5 = pentagon, ...)
  pos: Vec3; // face centroid, local space
  normal: Vec3; // outward unit normal, local space
}

export function centerVertices(vs: Vec3[]): Vec3[] {
  const c: Vec3 = [0, 0, 0];
  for (const v of vs) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  c[0] /= vs.length;
  c[1] /= vs.length;
  c[2] /= vs.length;
  return vs.map((v) => [v[0] - c[0], v[1] - c[1], v[2] - c[2]] as Vec3);
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function buildConnectors(vertices: Vec3[], edges: [number, number][]): Connector[] {
  const degree = new Array(vertices.length).fill(0);
  for (const [i, j] of edges) {
    degree[i]++;
    degree[j]++;
  }
  return vertices.map((pos, id) => ({ id, degree: degree[id], pos }));
}

export function makeSpec(
  id: string,
  name: string,
  faceCount: number,
  rawVerts: Vec3[],
  edges: [number, number][],
  faces: number[][],
): PolyhedronSpec {
  // Normalize to unit edge length here, once, using the measured length of the
  // first edge. Individual raw*() builders are free to use whatever reference
  // scale is convenient (circumradius 1, etc.) without needing to pre-derive
  // the right divisor by hand — this is what an earlier D6/D8/D10/D12/D20 bug was.
  const [i0, j0] = edges[0];
  const L = dist(rawVerts[i0], rawVerts[j0]);
  const unit = rawVerts.map((v) => [v[0] / L, v[1] / L, v[2] / L] as Vec3);
  const vertices = centerVertices(unit);
  return { id, name, faceCount, vertices, edges, faces, connectors: buildConnectors(vertices, edges) };
}

/**
 * Catalan-solid counterpart to makeSpec — "unit edge length" doesn't
 * apply (11 of the 13 Catalan solids have 2-3 distinct edge lengths per
 * face; a single reference edge would silently pick an arbitrary one of
 * them). Normalizes by circumradius instead: the distance to the
 * FARTHEST vertex, scaled to exactly 1. Decided empirically, not by
 * default — see docs/catalan-solids-spec.md's "Normalization
 * convention, decided" section for the 3 rejected alternatives
 * (insphere=1, a global skewed-insphere constant, trusting each
 * shape's natural unnormalized polar-dual scale) and why circumradius=1
 * is the only one of the 4 that guarantees consistent visual scale
 * across the whole family rather than approximating it well for some
 * shapes and badly for others.
 */
export function makeSpecByCircumradius(
  id: string,
  name: string,
  faceCount: number,
  rawVerts: Vec3[],
  edges: [number, number][],
  faces: number[][],
): PolyhedronSpec {
  const centered = centerVertices(rawVerts);
  const R = Math.max(...centered.map((v) => Math.hypot(v[0], v[1], v[2])));
  const vertices = centered.map((v) => [v[0] / R, v[1] / R, v[2] / R] as Vec3);
  return { id, name, faceCount, vertices, edges, faces, connectors: buildConnectors(vertices, edges) };
}

/**
 * Whether two faces are true geometric matches for face-attach — same
 * vertex count is NOT enough once irregular-faced families exist
 * (Catalan solids): a rhombic dodecahedron's rhombus (diagonal ratio
 * sqrt(2)) and a rhombic triacontahedron's rhombus (diagonal ratio phi)
 * are both 4-sided, but gluing one onto the other would not sit flush
 * — a genuinely different shape, not just a scale mismatch. Checks
 * whether face2's own edge-length AND interior-angle sequence (computed
 * the same way faceRotationalSymmetry does) matches face1's under some
 * cyclic rotation. Rotation only, deliberately NOT also checking the
 * reversed (mirrored) winding: a first attempt did, reasoning that
 * flipping which way an incoming piece presents its face was a valid
 * physical option — but the actual attach transform (ShapeViewer.tsx /
 * verify-face-attach.ts's computeFaceAttach) only ever computes a
 * rotation, never a reflection, so a pair that's congruent only via
 * mirroring would be offered as compatible but couldn't actually be
 * achieved by the real transform. Caught by verify-face-attach.ts
 * itself: RHOMBIC_TRIACONTAHEDRON attaching to a second copy of itself,
 * at several of its own face pairs, failed to coincide even though
 * every one of its faces is the identical rhombus — those specific
 * pairs were only reachable via the reflected match, not a true
 * rotation. For every regular-faced family already in this registry,
 * any two same-vertex-count faces already ARE congruent by
 * construction (a unit-edge square always matches another unit-edge
 * square) — this is a strict generalization, not a special case, and
 * reduces to the old "same vertex count" behavior for all of them
 * automatically.
 */
export function facesCongruent(
  verticesA: Vec3[],
  faceA: number[],
  verticesB: Vec3[],
  faceB: number[],
  tol = 1e-4,
): boolean {
  const n = faceA.length;
  if (faceB.length !== n) return false;
  const sequenceFor = (vertices: Vec3[], face: number[]): { edges: number[]; angles: number[] } => {
    const pts = face.map((i) => vertices[i]);
    const edges = Array.from({ length: n }, (_, k) => dist(pts[k], pts[(k + 1) % n]));
    const angleAt = (k: number): number => {
      const prev = pts[(k - 1 + n) % n];
      const curr = pts[k];
      const next = pts[(k + 1) % n];
      const v1: Vec3 = [prev[0] - curr[0], prev[1] - curr[1], prev[2] - curr[2]];
      const v2: Vec3 = [next[0] - curr[0], next[1] - curr[1], next[2] - curr[2]];
      const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
      const cos = dot / (Math.hypot(...v1) * Math.hypot(...v2));
      return Math.acos(Math.min(1, Math.max(-1, cos)));
    };
    const angles = Array.from({ length: n }, (_, k) => angleAt(k));
    return { edges, angles };
  };
  const a = sequenceFor(verticesA, faceA);
  const b = sequenceFor(verticesB, faceB);
  const matchesAt = (edgesB: number[], anglesB: number[], offset: number): boolean => {
    for (let k = 0; k < n; k++) {
      const j = (k + offset) % n;
      if (Math.abs(a.edges[k] - edgesB[j]) > tol || Math.abs(a.angles[k] - anglesB[j]) > tol) return false;
    }
    return true;
  };
  for (let offset = 0; offset < n; offset++) {
    if (matchesAt(b.edges, b.angles, offset)) return true;
  }
  return false;
}

/**
 * A face's own rotational (cyclic) symmetry order — how many discrete
 * "registrations" face-attach genuinely offers for THIS face, replacing
 * the old blind assumption "always equal to the face's own vertex
 * count" (only true for a regular n-gon's full rotational symmetry).
 * Computed from the face's actual geometry: BOTH its edge-length
 * sequence AND its interior-angle sequence around the polygon, checking
 * every cyclic rotation offset for self-consistency. Edge length alone
 * isn't enough — a rhombus has 4 equal edges but only 2-fold rotational
 * symmetry, since its interior angles alternate (θ, 180°−θ, θ, 180°−θ).
 * Reduces to the old `faceSize` value for every regular-polygon face
 * already in this registry (every rotation offset matches), so this is
 * a strict generalization, not a special case for one family — see
 * docs/catalan-solids-spec.md.
 */
export function faceRotationalSymmetry(vertices: Vec3[], face: number[], tol = 1e-4): number {
  const n = face.length;
  const pts = face.map((i) => vertices[i]);
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mag = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
  const angleAt = (k: number): number => {
    const prev = pts[(k - 1 + n) % n];
    const curr = pts[k];
    const next = pts[(k + 1) % n];
    const v1 = sub(prev, curr);
    const v2 = sub(next, curr);
    const cos = dot3(v1, v2) / (mag(v1) * mag(v2));
    return Math.acos(Math.min(1, Math.max(-1, cos)));
  };
  const angles = Array.from({ length: n }, (_, k) => angleAt(k));
  const edgeLens = Array.from({ length: n }, (_, k) => dist(pts[k], pts[(k + 1) % n]));
  let order = 0;
  for (let r = 0; r < n; r++) {
    let matches = true;
    for (let k = 0; k < n; k++) {
      if (Math.abs(angles[k] - angles[(k + r) % n]) > tol || Math.abs(edgeLens[k] - edgeLens[(k + r) % n]) > tol) {
        matches = false;
        break;
      }
    }
    if (matches) order++;
  }
  return order;
}

/**
 * Face connectors — the face-snap-mode counterpart to buildConnectors(),
 * derived from `vertices` + `faces` exactly the way vertex connectors are
 * derived from `vertices` + `edges` (construction-kit-spec.md's "Dual /
 * face-snap mode" design, not a new stored field). The outward normal comes
 * from the face's own CCW winding (already required for correct flat-shaded
 * rendering), so it's a genuine cross-check of that winding wherever it's
 * used, not just an assumption repeated — see scripts/verify-face-connectors.ts.
 */
export function buildFaceConnectors(spec: PolyhedronSpec): FaceConnector[] {
  return spec.faces.map((face, faceIndex) => {
    const pts = face.map((i) => spec.vertices[i]);
    const pos: Vec3 = [0, 0, 0];
    for (const p of pts) {
      pos[0] += p[0];
      pos[1] += p[1];
      pos[2] += p[2];
    }
    pos[0] /= pts.length;
    pos[1] /= pts.length;
    pos[2] /= pts.length;

    const [p0, p1, p2] = pts;
    const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cross: Vec3 = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const len = Math.hypot(cross[0], cross[1], cross[2]);
    const normal: Vec3 = [cross[0] / len, cross[1] / len, cross[2] / len];

    return { faceIndex, size: face.length, pos, normal };
  });
}

/** Fan-triangulates a convex n-gon face from its own first vertex — for rendering only, never stored. */
export function triangulateFace(face: number[]): [number, number, number][] {
  const tris: [number, number, number][] = [];
  for (let k = 1; k < face.length - 1; k++) {
    tris.push([face[0], face[k], face[k + 1]]);
  }
  return tris;
}

/** Re-checks that every edge is length 1 and every face's own boundary edges are all length 1. */
export function validateShape(spec: PolyhedronSpec, tol = 1e-6): string[] {
  const problems: string[] = [];
  for (const [i, j] of spec.edges) {
    const d = dist(spec.vertices[i], spec.vertices[j]);
    if (Math.abs(d - 1) > tol) problems.push(`${spec.id}: edge ${i}-${j} length ${d.toFixed(6)} != 1`);
  }
  for (const face of spec.faces) {
    for (let k = 0; k < face.length; k++) {
      const a = face[k];
      const b = face[(k + 1) % face.length];
      const d = dist(spec.vertices[a], spec.vertices[b]);
      if (Math.abs(d - 1) > tol) {
        problems.push(`${spec.id}: face [${face.join(',')}] edge ${a}-${b} length ${d.toFixed(6)} != 1`);
      }
    }
  }
  // Handshake lemma: every edge borders exactly 2 faces, so summing face
  // sizes and halving must equal the edge count. Generalizes the old
  // triangle-only "faceCount*3/2" check to any mix of face sizes.
  const impliedEdges = spec.faces.reduce((sum, f) => sum + f.length, 0) / 2;
  if (spec.edges.length !== impliedEdges) {
    problems.push(`${spec.id}: edge count ${spec.edges.length} != face-implied ${impliedEdges}`);
  }
  if (spec.faces.length !== spec.faceCount) {
    problems.push(`${spec.id}: face count ${spec.faces.length} != expected ${spec.faceCount}`);
  }
  return problems;
}

/**
 * Catalan-solid counterpart to validateShape — "every edge is length 1"
 * doesn't apply here (see makeSpecByCircumradius). Checks the properties
 * that actually define a valid Catalan solid instead: Euler's formula
 * and face count (shared with validateShape), every face's own edge
 * lengths forming a valid closed polygon matching every OTHER face's
 * edge-length multiset (true congruence across the whole shape, not
 * just internal consistency of one face), and — the actual defining
 * property of face-transitivity — every face sitting at the same
 * distance from the shape's own center (a uniform insphere radius).
 */
export function validateCatalanShape(spec: PolyhedronSpec, tol = 1e-6): string[] {
  const problems: string[] = [];
  const impliedEdges = spec.faces.reduce((sum, f) => sum + f.length, 0) / 2;
  if (spec.edges.length !== impliedEdges) {
    problems.push(`${spec.id}: edge count ${spec.edges.length} != face-implied ${impliedEdges}`);
  }
  if (spec.faces.length !== spec.faceCount) {
    problems.push(`${spec.id}: face count ${spec.faces.length} != expected ${spec.faceCount}`);
  }
  const eulerLhs = spec.vertices.length - spec.edges.length + spec.faces.length;
  if (eulerLhs !== 2) {
    problems.push(`${spec.id}: Euler's formula fails, V-E+F=${eulerLhs}`);
  }

  let referenceSignature: number[] | null = null;
  const insphereDists: number[] = [];
  for (const face of spec.faces) {
    const n = face.length;
    const edgeLens = Array.from({ length: n }, (_, k) => dist(spec.vertices[face[k]], spec.vertices[face[(k + 1) % n]]));
    const signature = [...edgeLens].sort((a, b) => a - b);
    if (referenceSignature === null) {
      referenceSignature = signature;
    } else if (signature.length !== referenceSignature.length || signature.some((v, i) => Math.abs(v - referenceSignature![i]) > tol)) {
      problems.push(
        `${spec.id}: face [${face.join(',')}] edge-length signature [${signature.map((v) => v.toFixed(4)).join(',')}] ` +
          `doesn't match the reference [${referenceSignature.map((v) => v.toFixed(4)).join(',')}] — not truly congruent to every other face`,
      );
    }

    const centroid: Vec3 = [0, 0, 0];
    for (const i of face) {
      centroid[0] += spec.vertices[i][0];
      centroid[1] += spec.vertices[i][1];
      centroid[2] += spec.vertices[i][2];
    }
    centroid[0] /= n;
    centroid[1] /= n;
    centroid[2] /= n;
    insphereDists.push(Math.hypot(centroid[0], centroid[1], centroid[2]));
  }
  const inMin = Math.min(...insphereDists);
  const inMax = Math.max(...insphereDists);
  if (inMax - inMin > tol) {
    problems.push(`${spec.id}: insphere radius not uniform across faces — min ${inMin.toFixed(6)} max ${inMax.toFixed(6)} (not face-transitive)`);
  }

  return problems;
}
