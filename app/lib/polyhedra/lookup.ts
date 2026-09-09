/**
 * Rendering-path-only spec lookup that also knows about STAR_POLYHEDRA.
 * Deliberately separate from POLYHEDRA itself (index.ts) -- every attach/
 * build code path (ShapeViewer, PolyhedralWheel, core.ts's facesCongruent,
 * etc.) keeps reading POLYHEDRA directly and unchanged, so star polyhedra
 * stay structurally unreachable there. Only display components (preview
 * cards, the detail drawer, stats) need to resolve either registry, since
 * that's the one part of the app where these 4 solids ARE reachable (Full
 * Catalog's own reference-only section). See docs/star-polyhedra-spec.md.
 */
import { POLYHEDRA } from './index';
import { STAR_POLYHEDRA, STAR_POLYHEDRON_IDS } from './starPolyhedra';
import type { PolyhedronSpec } from './core';

const STAR_ID_SET = new Set<string>(STAR_POLYHEDRON_IDS);

export function isStarPolyhedron(id: string): boolean {
  return STAR_ID_SET.has(id);
}

export function getAnySpec(id: string): PolyhedronSpec | undefined {
  return POLYHEDRA[id] ?? STAR_POLYHEDRA[id];
}
