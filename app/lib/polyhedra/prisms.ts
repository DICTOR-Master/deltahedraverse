/**
 * prisms.ts — the last piece of Zalgaller's "complete classification of
 * convex regular-faced polyhedra" not yet in this registry (5 Platonic +
 * 13 Archimedean + prisms/antiprisms + 92 Johnson) — see
 * docs/prisms-antiprisms-spec.md for the full design record. Unlike
 * every other family, prisms/antiprisms are parametric in n rather than
 * a fixed, finite named set, so this file generates coordinates directly
 * from the same closed-form formulas `johnson.ts` already trusts for
 * elongation/gyroelongation (regular n-gon circumradius, antiprism
 * height via law of cosines) instead of transcribing scipy ConvexHull
 * output — lower transcription risk for a family this simple, per the
 * spec doc's reasoning.
 *
 * Every face here (n-gon caps, square or triangle sides) is a regular
 * polygon, so unlike catalan.ts this needs none of the irregular-face
 * infrastructure (`makeSpecByCircumradius`, the face-vertex-0
 * canonicalization fix) — plain `makeSpec` and the existing
 * `facesCongruent`/`faceRotationalSymmetry` apply unchanged.
 *
 * Capped at n=10 (matching the largest regular-polygon face already
 * anywhere in this registry, the decagon) with two dedupes skipped:
 * PRISM_4 = CUBE (already Platonic) and ANTIPRISM_3 = OCTAHEDRON
 * (already a deltahedron, D8) — both provably identical to shapes
 * already registered, same standard as every prior family's dedupes.
 */

import { type Vec3, type PolyhedronSpec, makeSpec } from './core';

function regularNgonCircumradius(n: number): number {
  return 1 / (2 * Math.sin(Math.PI / n));
}

function buildPrismRaw(n: number): { verts: Vec3[]; edges: [number, number][]; faces: number[][] } {
  const R = regularNgonCircumradius(n);
  const verts: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const theta = (2 * Math.PI * k) / n;
    verts.push([R * Math.cos(theta), R * Math.sin(theta), -0.5]);
  }
  for (let k = 0; k < n; k++) {
    const theta = (2 * Math.PI * k) / n;
    verts.push([R * Math.cos(theta), R * Math.sin(theta), 0.5]);
  }

  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    edges.push([k, (k + 1) % n]);
    edges.push([n + k, n + ((k + 1) % n)]);
    edges.push([k, n + k]);
  }

  const faces: number[][] = [];
  // Bottom cap: outward normal -z, so reverse the natural (CCW-from-above)
  // winding to get CCW-from-below.
  const bottom: number[] = [];
  for (let k = 0; k < n; k++) bottom.push((n - k) % n);
  faces.push(bottom);
  // Top cap: outward normal +z, natural increasing-angle order is already
  // CCW-from-above.
  const top: number[] = [];
  for (let k = 0; k < n; k++) top.push(n + k);
  faces.push(top);
  // Lateral squares.
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    faces.push([k, k2, n + k2, n + k]);
  }

  return { verts, edges, faces };
}

function buildAntiprismRaw(n: number): { verts: Vec3[]; edges: [number, number][]; faces: number[][] } {
  const R = regularNgonCircumradius(n);
  // Law-of-cosines derivation, same formula johnson.ts's batch-2
  // gyroelongation already trusts: h^2 = 1 - 2*R^2*(1 - cos(pi/n)).
  const h = Math.sqrt(1 - 2 * R * R * (1 - Math.cos(Math.PI / n)));

  const verts: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const theta = (2 * Math.PI * k) / n;
    verts.push([R * Math.cos(theta), R * Math.sin(theta), -h / 2]);
  }
  for (let k = 0; k < n; k++) {
    // Top ring twisted by half a step (pi/n) relative to the bottom ring.
    const theta = (2 * Math.PI * k) / n + Math.PI / n;
    verts.push([R * Math.cos(theta), R * Math.sin(theta), h / 2]);
  }

  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    edges.push([k, (k + 1) % n]);
    edges.push([n + k, n + ((k + 1) % n)]);
    // top_k sits angularly between bottom_k and bottom_{k+1}, so both are
    // its nearest bottom-ring neighbors -- the zigzag diagonals.
    edges.push([k, n + k]);
    edges.push([(k + 1) % n, n + k]);
  }

  const faces: number[][] = [];
  const bottom: number[] = [];
  for (let k = 0; k < n; k++) bottom.push((n - k) % n);
  faces.push(bottom);
  const top: number[] = [];
  for (let k = 0; k < n; k++) top.push(n + k);
  faces.push(top);
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    // "Down-pointing" triangle: base on the bottom ring, apex on top.
    faces.push([k, k2, n + k]);
    // "Up-pointing" triangle: base on the top ring, apex on bottom.
    faces.push([n + k2, n + k, k2]);
  }

  return { verts, edges, faces };
}

export const PRISM_ANTIPRISM_ADDITIONS: Record<string, PolyhedronSpec> = {};

for (const n of [3, 5, 6, 7, 8, 9, 10]) {
  const { verts, edges, faces } = buildPrismRaw(n);
  PRISM_ANTIPRISM_ADDITIONS[`PRISM_${n}`] = makeSpec(`PRISM_${n}`, `${n}-gonal prism`, 2 + n, verts, edges, faces);
}

for (const n of [4, 5, 6, 7, 8, 9, 10]) {
  const { verts, edges, faces } = buildAntiprismRaw(n);
  PRISM_ANTIPRISM_ADDITIONS[`ANTIPRISM_${n}`] = makeSpec(
    `ANTIPRISM_${n}`,
    `${n}-gonal antiprism`,
    2 + 2 * n,
    verts,
    edges,
    faces,
  );
}

export const PRISM_ANTIPRISM_ADDITION_IDS = Object.keys(PRISM_ANTIPRISM_ADDITIONS);
