/**
 * The combined registry across every polyhedron family. Individual family
 * files (deltahedra.ts, platonic.ts, archimedean.ts, johnson.ts, catalan.ts)
 * stay independently importable for family-specific logic (the D10<->D12
 * rewrite rule only ever needs DELTAHEDRA, for instance) — this file is
 * for anything that should work across all of them, like the shape picker
 * and the assembly graph's validation.
 */

import type { PolyhedronSpec } from './core';
import { DELTAHEDRA, DELTAHEDRON_IDS } from './deltahedra';
import { PLATONIC_ADDITIONS, PLATONIC_ADDITION_IDS } from './platonic';
import { ARCHIMEDEAN_ADDITIONS, ARCHIMEDEAN_ADDITION_IDS } from './archimedean';
import { JOHNSON_ADDITIONS, JOHNSON_ADDITION_IDS } from './johnson';
import { CATALAN_ADDITIONS, CATALAN_ADDITION_IDS } from './catalan';

export * from './core';
export { DELTAHEDRA, DELTAHEDRON_IDS } from './deltahedra';
export { PLATONIC_ADDITIONS, PLATONIC_ADDITION_IDS } from './platonic';
export { ARCHIMEDEAN_ADDITIONS, ARCHIMEDEAN_ADDITION_IDS } from './archimedean';
export { JOHNSON_ADDITIONS, JOHNSON_ADDITION_IDS } from './johnson';
export { CATALAN_ADDITIONS, CATALAN_ADDITION_IDS } from './catalan';

export const POLYHEDRA: Record<string, PolyhedronSpec> = {
  ...DELTAHEDRA,
  ...PLATONIC_ADDITIONS,
  ...ARCHIMEDEAN_ADDITIONS,
  ...JOHNSON_ADDITIONS,
  ...CATALAN_ADDITIONS,
};

export const POLYHEDRON_IDS: string[] = [
  ...DELTAHEDRON_IDS,
  ...PLATONIC_ADDITION_IDS,
  ...ARCHIMEDEAN_ADDITION_IDS,
  ...JOHNSON_ADDITION_IDS,
  ...CATALAN_ADDITION_IDS,
];
