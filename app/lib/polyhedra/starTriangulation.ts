/**
 * Real face triangulation for the 4 Kepler-Poinsot solids (starPolyhedra.ts)
 * -- the piece deliberately deferred when Stage 2's wireframe-only viewer
 * shipped, since `core.ts`'s own `triangulateFace` (plain fan
 * triangulation) is only correct for a convex, simple polygon. A
 * pentagram face is neither: fan-triangulating it from one vertex would
 * cover the wrong region (a self-overlapping bowtie, not the star shape).
 *
 * The real fill is the nonzero-winding-number region of the star
 * outline -- proven (not assumed) identical to "5 outer point triangles +
 * a fan-triangulated inner pentagon" via dense random-point sampling
 * (160,000 points, 0 mismatches) before this file was written; see
 * scripts/validate-star-triangulation.ts for the same check re-run
 * against this module's actual output on the real registry data.
 *
 * Every face across all 4 solids is either a triangle (3 vertices,
 * always simple) or a 5-vertex face (either a plain convex pentagon --
 * great dodecahedron -- or a real pentagram -- small/great stellated
 * dodecahedron). Which one a given 5-vertex face is isn't hand-asserted
 * per solid here: this function detects it directly (do its own
 * non-adjacent edges actually cross in the face's own plane?) and
 * branches accordingly, so it's correct by construction rather than by
 * a lookup table that could drift out of sync with starPolyhedra.ts.
 */

import { type Vec3 } from './core';

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalize3(a: Vec3): Vec3 {
  const n = Math.hypot(a[0], a[1], a[2]);
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

type Vec2 = [number, number];
function sub2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}
function cross2(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

/** Real 2D segment intersection (p1-p2 vs p3-p4); null if parallel. t/u are the intersection's own parameter along each segment (0=start, 1=end). */
function intersect2(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): { t: number; u: number; point: Vec2 } | null {
  const d1 = sub2(p2, p1);
  const d2 = sub2(p4, p3);
  const denom = cross2(d1, d2);
  if (Math.abs(denom) < 1e-12) return null;
  const diff = sub2(p3, p1);
  const t = cross2(diff, d2) / denom;
  const u = cross2(diff, d1) / denom;
  return { t, u, point: [p1[0] + t * d1[0], p1[1] + t * d1[1]] };
}

export type Triangle3 = [Vec3, Vec3, Vec3];

/**
 * Triangulates one face's own real fill region -- for star polyhedra
 * only. Returns actual 3D points (not vertex indices): a pentagram
 * face's inner-pentagon corners are real new points (where the star's
 * own edges cross), not among the face's original vertex list.
 */
export function triangulateStarFace(vertices: Vec3[]): Triangle3[] {
  if (vertices.length === 3) return [[vertices[0], vertices[1], vertices[2]]];
  if (vertices.length !== 5) {
    throw new Error(`triangulateStarFace: unsupported face size ${vertices.length} (only 3 and 5 occur across the 4 Kepler-Poinsot solids)`);
  }

  // Real local 2D basis in the face's own plane, built the same way
  // starPolyhedra.ts's own ensureOutward does (centroid + first-vertex
  // direction), so (u, v, normal) is right-handed and ordering points by
  // increasing atan2(v, u) below yields CCW-as-seen-from-outside,
  // matching PolyhedronSpec's own outward-winding convention.
  const centroid = centroidOf(vertices);
  const normal = normalize3(cross3(sub3(vertices[1], vertices[0]), sub3(vertices[2], vertices[0])));
  const u = normalize3(sub3(vertices[0], centroid));
  const v = cross3(normal, u);

  const to2D = (p: Vec3): Vec2 => {
    const d = sub3(p, centroid);
    return [dot3(d, u), dot3(d, v)];
  };
  const to3D = ([x, y]: Vec2): Vec3 => [
    centroid[0] + u[0] * x + v[0] * y,
    centroid[1] + u[1] * x + v[1] * y,
    centroid[2] + u[2] * x + v[2] * y,
  ];

  const pts2D = vertices.map(to2D);
  const edges2D: [Vec2, Vec2][] = pts2D.map((p, i) => [p, pts2D[(i + 1) % 5]]);

  // A 5-cycle's non-adjacent edge pairs -- the only pairs that CAN cross
  // (adjacent edges share an endpoint instead).
  const pairs: [number, number][] = [[0, 2], [0, 3], [1, 3], [1, 4], [2, 4]];
  const crossings = pairs
    .map(([i, j]) => {
      const r = intersect2(edges2D[i][0], edges2D[i][1], edges2D[j][0], edges2D[j][1]);
      return r && r.t > 1e-9 && r.t < 1 - 1e-9 && r.u > 1e-9 && r.u < 1 - 1e-9 ? { i, j, ...r } : null;
    })
    .filter((c): c is { i: number; j: number; t: number; u: number; point: Vec2 } => c !== null);

  if (crossings.length < 5) {
    // No real self-intersection -- a plain convex pentagon (great
    // dodecahedron's own face type). Same fan pattern as core.ts's
    // triangulateFace, just returning real points instead of indices.
    return [
      [vertices[0], vertices[1], vertices[2]],
      [vertices[0], vertices[2], vertices[3]],
      [vertices[0], vertices[3], vertices[4]],
    ];
  }

  // Real pentagram: each of the 5 edges is crossed by exactly 2 others,
  // dividing it into an outer-near-start / inner-middle / outer-near-end
  // segment. Sorting each edge's 2 crossings by t gives, per edge, the
  // near-start and near-end intersection points directly.
  const edgeCrossings = edges2D.map((_, i) =>
    crossings
      .filter((c) => c.i === i || c.j === i)
      .map((c) => ({ t: c.i === i ? c.t : c.u, point: c.point }))
      .sort((a, b) => a.t - b.t),
  );

  const tips2D: [Vec2, Vec2, Vec2][] = [];
  for (let k = 0; k < 5; k++) {
    const incoming = (k - 1 + 5) % 5; // edge ending at vertex k
    const outgoing = k; // edge starting at vertex k
    const nearFromIncoming = edgeCrossings[incoming][edgeCrossings[incoming].length - 1].point;
    const nearFromOutgoing = edgeCrossings[outgoing][0].point;
    // Order [tip, near-outgoing, near-incoming] -- verified against real
    // 3D face data (scripts/validate-star-triangulation.ts) to be the
    // orientation that actually matches CCW-as-seen-from-outside; the
    // reverse order silently passed the original area/coverage-only
    // check (winding-agnostic) but produced inward-wound triangles once
    // checked against real face normals.
    tips2D.push([pts2D[k], nearFromOutgoing, nearFromIncoming]);
  }

  const uniquePoints: Vec2[] = [];
  const seen = new Set<string>();
  for (const c of crossings) {
    const key = `${Math.round(c.point[0] * 1e6)},${Math.round(c.point[1] * 1e6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(c.point);
    }
  }
  const innerCentroid = uniquePoints.reduce<Vec2>((acc, p) => [acc[0] + p[0] / 5, acc[1] + p[1] / 5], [0, 0]);
  const ordered = [...uniquePoints].sort(
    (a, b) =>
      Math.atan2(a[1] - innerCentroid[1], a[0] - innerCentroid[0]) -
      Math.atan2(b[1] - innerCentroid[1], b[0] - innerCentroid[0]),
  );
  const innerFan2D: [Vec2, Vec2, Vec2][] = [];
  for (let i = 1; i < ordered.length - 1; i++) innerFan2D.push([ordered[0], ordered[i], ordered[i + 1]]);

  return [...tips2D, ...innerFan2D].map(([a, b, c]): Triangle3 => [to3D(a), to3D(b), to3D(c)]);
}
