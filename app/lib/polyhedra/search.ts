/**
 * Pure faceted-search matcher shared by the ShapeBrowser's Search screen
 * (and, via countWith, its zero-result chip-hiding logic). Kept separate
 * from the component tree so it's independently verifiable (see
 * scripts/verify-search.ts) and reusable by Home/Favorites if they ever
 * need the same predicate.
 *
 * Facet semantics, matching the validated karaoke-picker prototype:
 *  - families: multi-select, AND/intersection ("belongs to every selected
 *    family", never the union of either).
 *  - faceShapes: multi-select, OR within the group ("has at least one of
 *    these face sizes").
 *  - faceCountBand: single-select, optional -- never blocks the picker
 *    when left unset.
 */

import { POLYHEDRA, POLYHEDRON_IDS, type PolyhedronSpec } from './index';
import { familiesFor, type FamilyKey } from './families';

export type FaceCountBand = 'le10' | '11-30' | '31plus';

export interface Filters {
  query: string;
  families: FamilyKey[];
  faceShapes: number[];
  faceCountBand: FaceCountBand | null;
}

export const EMPTY_FILTERS: Filters = { query: '', families: [], faceShapes: [], faceCountBand: null };

function matchesBand(faceCount: number, band: FaceCountBand): boolean {
  if (band === 'le10') return faceCount <= 10;
  if (band === '11-30') return faceCount >= 11 && faceCount <= 30;
  return faceCount >= 31;
}

export function matchesFilters(spec: PolyhedronSpec, f: Filters): boolean {
  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase();
    const name = spec.name.replaceAll('_', ' ').toLowerCase();
    if (!name.includes(q) && !spec.id.toLowerCase().includes(q)) return false;
  }
  if (f.families.length > 0) {
    const specFamilies = new Set(familiesFor(spec));
    if (!f.families.every((fam) => specFamilies.has(fam))) return false; // AND/intersection
  }
  if (f.faceShapes.length > 0) {
    const sizes = new Set(spec.faces.map((face) => face.length));
    if (!f.faceShapes.some((n) => sizes.has(n))) return false; // OR within this facet group
  }
  if (f.faceCountBand && !matchesBand(spec.faceCount, f.faceCountBand)) return false;
  return true;
}

export function filteredIds(f: Filters, restrictTo?: string[]): string[] {
  const pool = restrictTo ?? POLYHEDRON_IDS;
  return pool.filter((id) => {
    const spec = POLYHEDRA[id];
    return spec ? matchesFilters(spec, f) : false;
  });
}

export function hasActiveFilter(f: Filters): boolean {
  return f.query.trim().length > 0 || f.families.length > 0 || f.faceShapes.length > 0 || f.faceCountBand !== null;
}

/**
 * Result count if `override` were merged into `base`. Used to decide
 * whether an as-yet-unselected chip should render at all: any chip whose
 * hypothetical selection would zero out the result set is hidden rather
 * than shown disabled (the "narrowing must never dead-end" requirement).
 */
export function countWith(base: Filters, override: Partial<Filters>, restrictTo?: string[]): number {
  return filteredIds({ ...base, ...override }, restrictTo).length;
}

/** All distinct face-gon sizes actually present anywhere in the registry, ascending. */
export function allFaceShapeSizes(): number[] {
  const sizes = new Set<number>();
  for (const id of POLYHEDRON_IDS) {
    POLYHEDRA[id].faces.forEach((face) => sizes.add(face.length));
  }
  return [...sizes].sort((a, b) => a - b);
}

export const FACE_COUNT_BANDS: Array<{ id: FaceCountBand; label: string }> = [
  { id: 'le10', label: '≤10 Faces' },
  { id: '11-30', label: '11–30 Faces' },
  { id: '31plus', label: '31+ Faces' },
];
