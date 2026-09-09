/**
 * Canonical family/facet data layer, shared by PolyhedralWheel and the
 * ShapeBrowser (karaoke-style picker). Single source of truth so the two
 * UIs can never disagree about family membership, labels, or symbols.
 *
 * A shape's family isn't always singular. The registry's own comments say
 * so directly: platonic.ts skips the tetrahedron/octahedron/icosahedron
 * because "they're D4/D8/D20 in ./deltahedra.ts" (they ARE Platonic
 * solids, just not re-derived there), and prisms.ts skips the 4-gonal
 * prism and 3-gonal antiprism because those ARE the cube and the
 * octahedron. So a shape can carry more than one family tag -- encoded
 * below as an explicit, documented overlap patch (EXTRA_MEMBERSHIP)
 * layered on top of the registry's own per-family id arrays, never
 * guessed at runtime.
 */

import {
  POLYHEDRA,
  DELTAHEDRON_IDS,
  PLATONIC_ADDITION_IDS,
  ARCHIMEDEAN_ADDITION_IDS,
  JOHNSON_ADDITION_IDS,
  CATALAN_ADDITION_IDS,
  PRISM_ANTIPRISM_ADDITION_IDS,
  type PolyhedronSpec,
} from './index';

export type FamilyKey =
  | 'DELTAHEDRA'
  | 'PLATONIC'
  | 'ARCHIMEDEAN'
  | 'JOHNSON'
  | 'CATALAN'
  | 'PRISMS'
  | 'ANTIPRISMS';

export const FAMILY_ORDER: FamilyKey[] = [
  'DELTAHEDRA',
  'PLATONIC',
  'ARCHIMEDEAN',
  'JOHNSON',
  'CATALAN',
  'PRISMS',
  'ANTIPRISMS',
];

// Single source of truth for both PolyhedralWheel and the ShapeBrowser
// (HomeScreen/SearchScreen already import FAMILY_META directly, so a
// symbol changed here updates everywhere at once -- there was never
// actually a second, independently-chosen "karaoke view" symbol set to
// reconcile, just a request for more universally-distinct glyphs).
// Revised for real distinctiveness, not picked freehand: every symbol
// has its own base SHAPE (triangle/pentagon/hexagon/diamond/rectangle),
// no two sharing one the way Catalan's old small-diamond (⬦) and
// Platonic's own diamond (◇) once did. Outline-vs-filled is used
// deliberately, not decoratively, for the two families with a genuine
// real-world relationship: Archimedean/Catalan (true polar duals -- see
// this level's own comment in PolyhedralWheel.tsx) share the hexagon
// outline/fill pair, and Prisms/Antiprisms (a natural paired
// construction family, though not strict duals of each other) share
// the rectangle outline/fill pair -- so the symbol choice itself
// reinforces which families are related, not just avoids collisions.
// PLATONIC is a pentagon (⬠) as a direct count mnemonic -- there are
// exactly five Platonic solids. JOHNSON took over the diamond (◇) that
// pentagon displaced (Johnson has no dual/pairing relationship to
// encode, so any distinct outline shape works). ★ is deliberately
// NOT used by any convex family here -- reserved for a possible future
// non-interactive "star polyhedra" category (Kepler-Poinsot and other
// non-convex forms), where it would actually mean something.
export const FAMILY_META: Record<FamilyKey, { label: string; symbol: string }> = {
  DELTAHEDRA: { label: 'Deltahedra', symbol: '△' },
  PLATONIC: { label: 'Platonic', symbol: '⬠' },
  ARCHIMEDEAN: { label: 'Archimedean', symbol: '⬡' },
  JOHNSON: { label: 'Johnson', symbol: '◇' },
  CATALAN: { label: 'Catalan', symbol: '⬢' },
  PRISMS: { label: 'Prisms', symbol: '▭' },
  ANTIPRISMS: { label: 'Antiprisms', symbol: '▬' },
};

// Base membership, derived (never hand-copied) from the registry's own
// per-family id arrays. PRISM_ANTIPRISM_ADDITION_IDS arrives as a single
// merged array from prisms.ts (built from both PRISM_<n>/ANTIPRISM_<n>
// keys) -- split it by id prefix so Prisms and Antiprisms are two
// separate, independently browsable families.
const BASE_IDS: Record<FamilyKey, string[]> = {
  DELTAHEDRA: DELTAHEDRON_IDS,
  PLATONIC: PLATONIC_ADDITION_IDS,
  ARCHIMEDEAN: ARCHIMEDEAN_ADDITION_IDS,
  JOHNSON: JOHNSON_ADDITION_IDS,
  CATALAN: CATALAN_ADDITION_IDS,
  PRISMS: PRISM_ANTIPRISM_ADDITION_IDS.filter((id) => id.startsWith('PRISM_')),
  ANTIPRISMS: PRISM_ANTIPRISM_ADDITION_IDS.filter((id) => id.startsWith('ANTIPRISM_')),
};

// Explicit, documented cross-family overlap patch -- encodes facts that
// today only live as comments in platonic.ts / prisms.ts, plus the
// registry's own deliberate split of "strictly convex deltahedra" into
// their own D-id family instead of J-numbering them:
//   - D4 (tetrahedron), D8 (octahedron), D20 (icosahedron):
//     Deltahedra AND Platonic
//   - CUBE: Platonic AND Prisms ("PRISM_4 = CUBE, already Platonic")
//   - D8 (octahedron): also Antiprisms ("ANTIPRISM_3 = OCTAHEDRON")
//   - D6/D10/D12/D14/D16: Deltahedra AND Johnson -- these ARE the
//     canonical J12 (triangular bipyramid), J13 (pentagonal bipyramid),
//     J84 (snub disphenoid), J51 (triaugmented triangular prism), and J17
//     (gyroelongated square bipyramid) respectively, just stored under
//     their D-id here rather than duplicated as separate J-id entries.
//     Without this patch, familyIds('JOHNSON') undercounts at 87 instead
//     of the canonical 92, and these 5 shapes wouldn't be findable by
//     filtering/searching for "Johnson" even though they genuinely are
//     Johnson solids.
// Keyed by the REAL POLYHEDRA id used elsewhere (D4/D8/D20/CUBE/D6/D10/
// D12/D14/D16), never a synthetic PRISM_4/ANTIPRISM_3/J12/J13/J17/J51/J84
// id -- those are never separate POLYHEDRA entries, and BASE_IDS above
// already correctly omits them.
const EXTRA_MEMBERSHIP: Array<{ id: string; family: FamilyKey }> = [
  { id: 'D4', family: 'PLATONIC' },
  { id: 'D8', family: 'PLATONIC' },
  { id: 'D20', family: 'PLATONIC' },
  { id: 'CUBE', family: 'PRISMS' },
  { id: 'D8', family: 'ANTIPRISMS' },
  { id: 'D6', family: 'JOHNSON' },
  { id: 'D10', family: 'JOHNSON' },
  { id: 'D12', family: 'JOHNSON' },
  { id: 'D14', family: 'JOHNSON' },
  { id: 'D16', family: 'JOHNSON' },
];

const membershipMap: Map<string, Set<FamilyKey>> = (() => {
  const m = new Map<string, Set<FamilyKey>>();
  const add = (id: string, family: FamilyKey) => {
    if (!m.has(id)) m.set(id, new Set());
    m.get(id)!.add(family);
  };
  for (const family of FAMILY_ORDER) {
    for (const id of BASE_IDS[family]) add(id, family);
  }
  for (const { id, family } of EXTRA_MEMBERSHIP) add(id, family);
  return m;
})();

/** Every family a shape belongs to, in canonical FAMILY_ORDER order. */
export function familiesFor(specOrId: PolyhedronSpec | string): FamilyKey[] {
  const id = typeof specOrId === 'string' ? specOrId : specOrId.id;
  const set = membershipMap.get(id);
  if (!set) return [];
  return FAMILY_ORDER.filter((f) => set.has(f));
}

// Within a family, order by face type then face count, smallest to
// largest -- a geometrically intuitive browse order (simplest/most
// familiar shapes first) rather than registry-insertion order. Moved
// here (verbatim from PolyhedralWheel.tsx) so both the wheel and the new
// browser derive catalog numbers from the exact same order.
export function faceTypeSortKey(id: string): [number, number, number] {
  const spec = POLYHEDRA[id];
  const faceSizes = spec.faces.map((f) => f.length);
  const distinctSizes = new Set(faceSizes);
  return [Math.min(...faceSizes), distinctSizes.size, spec.faceCount];
}

function sortByFaceType(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ka = faceTypeSortKey(a);
    const kb = faceTypeSortKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });
}

const familyIdsCache = new Map<FamilyKey, string[]>();

/** Every shape id in a family (base + documented overlaps), face-type sorted. */
export function familyIds(family: FamilyKey): string[] {
  const cached = familyIdsCache.get(family);
  if (cached) return cached;
  const ids = sortByFaceType(
    FAMILY_ORDER.includes(family)
      ? Array.from(new Set([...BASE_IDS[family], ...EXTRA_MEMBERSHIP.filter((e) => e.family === family).map((e) => e.id)]))
      : [],
  );
  familyIdsCache.set(family, ids);
  return ids;
}

/** 1-indexed catalog position of every shape within a given family's own order. */
export function catalogByFamily(family: FamilyKey): Record<string, number> {
  const ids = familyIds(family);
  return Object.fromEntries(ids.map((id, i) => [id, i + 1]));
}
