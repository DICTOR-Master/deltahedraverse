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
