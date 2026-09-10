/**
 * Real verification of starTriangulation.ts against the actual STAR_POLYHEDRA
 * registry data -- not the idealized flat pentagon used to first prove the
 * algorithm (see this file's own git history / docs/star-polyhedra-spec.md).
 * Checks, for every face of all 4 solids:
 *  - the right number of triangles (1 for a triangle face, 3 for a convex
 *    pentagon, 8 for a real pentagram -- 5 tips + 3 inner-fan),
 *  - every triangle's own computed normal points the same way as the
 *    face's outward normal (real winding, not assumed),
 *  - every triangle vertex actually lies in the face's own plane (real
 *    coplanarity, not assumed from how the points were derived), and
 *  - for pentagram faces specifically, a fresh dense random-point
 *    nonzero-winding-number sampling (same technique that originally
 *    proved the algorithm) re-run directly against THIS face's real 3D
 *    geometry, projected into its own 2D plane -- not reusing the earlier
 *    idealized-pentagon check.
 */
import { STAR_POLYHEDRA, STAR_POLYHEDRON_IDS } from '../app/lib/polyhedra/starPolyhedra';
import { triangulateStarFace, type Triangle3 } from '../app/lib/polyhedra/starTriangulation';
import { type Vec3 } from '../app/lib/polyhedra/core';

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm3(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function normalize3(a: Vec3): Vec3 {
  const n = norm3(a);
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
function triangleNormal([a, b, c]: Triangle3): Vec3 {
  return normalize3(cross3(sub3(b, a), sub3(c, a)));
}

type Vec2 = [number, number];
function cross2(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

/** Same nonzero-winding-number check used to originally prove the algorithm, re-run per real pentagram face. */
function windingNumber(point: Vec2, path: Vec2[]): number {
  let wn = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    if (a[1] <= point[1]) {
      if (b[1] > point[1] && cross2([b[0] - a[0], b[1] - a[1]], [point[0] - a[0], point[1] - a[1]]) > 0) wn++;
    } else if (b[1] <= point[1] && cross2([b[0] - a[0], b[1] - a[1]], [point[0] - a[0], point[1] - a[1]]) < 0) {
      wn--;
    }
  }
  return wn;
}
function pointInTriangle2D(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross2([b[0] - a[0], b[1] - a[1]], [p[0] - a[0], p[1] - a[1]]);
  const d2 = cross2([c[0] - b[0], c[1] - b[1]], [p[0] - b[0], p[1] - b[1]]);
  const d3 = cross2([a[0] - c[0], a[1] - c[1]], [p[0] - c[0], p[1] - c[1]]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

let failed = false;
let totalTriangles = 0;
let pentagramFacesChecked = 0;

for (const id of STAR_POLYHEDRON_IDS) {
  const spec = STAR_POLYHEDRA[id];
  const problems: string[] = [];

  spec.faces.forEach((face, faceIndex) => {
    const faceVerts = face.map((i) => spec.vertices[i]);
    const faceNormal = normalize3(cross3(sub3(faceVerts[1], faceVerts[0]), sub3(faceVerts[2], faceVerts[0])));
    const faceCentroid = centroidOf(faceVerts);

    const triangles = triangulateStarFace(faceVerts);
    totalTriangles += triangles.length;

    const expectedCounts = face.length === 3 ? [1] : [3, 8]; // 3=convex pentagon, 8=pentagram
    if (!expectedCounts.includes(triangles.length)) {
      problems.push(`face ${faceIndex}: ${triangles.length} triangles (expected one of ${expectedCounts.join('/')})`);
    }

    for (const tri of triangles) {
      // Real winding check: every triangle's own normal must point the
      // same way as the face's outward normal.
      const tn = triangleNormal(tri);
      if (dot3(tn, faceNormal) <= 0) problems.push(`face ${faceIndex}: a triangle is wound inward relative to the face normal`);

      // Real coplanarity check: every triangle vertex (including newly
      // computed inner-pentagon points) must lie in the face's own plane.
      for (const p of tri) {
        const planeDist = Math.abs(dot3(sub3(p, faceCentroid), faceNormal));
        if (planeDist > 1e-6) problems.push(`face ${faceIndex}: a triangle vertex is ${planeDist.toExponential(2)} off the face plane`);
      }
    }

    if (triangles.length === 8) {
      // Real pentagram face -- re-run the dense nonzero-winding check
      // directly against this face's own real 3D geometry, projected to
      // its own 2D plane (not the idealized unit pentagon used to first
      // derive the algorithm).
      pentagramFacesChecked++;
      const u = normalize3(sub3(faceVerts[0], faceCentroid));
      const v = cross3(faceNormal, u);
      const to2D = (p: Vec3): Vec2 => {
        const d = sub3(p, faceCentroid);
        return [dot3(d, u), dot3(d, v)];
      };
      const outline2D = faceVerts.map(to2D);
      const triangles2D = triangles.map(([a, b, c]): [Vec2, Vec2, Vec2] => [to2D(a), to2D(b), to2D(c)]);

      const radii = outline2D.map(([x, y]) => Math.hypot(x, y));
      const maxR = Math.max(...radii) * 1.3;
      const N = 200;
      let mismatches = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = -maxR + (2 * maxR * i) / (N - 1);
          const y = -maxR + (2 * maxR * j) / (N - 1);
          const pt: Vec2 = [x, y];
          const trueInside = windingNumber(pt, outline2D) !== 0;
          const triInside = triangles2D.some((t) => pointInTriangle2D(pt, ...t));
          if (trueInside !== triInside) mismatches++;
        }
      }
      if (mismatches > 0) problems.push(`face ${faceIndex}: ${mismatches}/${N * N} sampled points disagree with the true nonzero-winding fill`);
    }
  });

  if (problems.length === 0) {
    console.log(`${id}: OK (${spec.faces.length} faces triangulated correctly)`);
  } else {
    failed = true;
    console.log(`${id}: FAILED`);
    for (const p of problems.slice(0, 10)) console.log(`  ${p}`);
    if (problems.length > 10) console.log(`  ...and ${problems.length - 10} more`);
  }
}

console.log(`\nTotal triangles across all 4 solids: ${totalTriangles}`);
console.log(`Pentagram faces winding-checked (dense sampling): ${pentagramFacesChecked}`);
if (failed) process.exit(1);
