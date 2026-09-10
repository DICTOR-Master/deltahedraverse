# Star Polyhedra (Kepler-Poinsot Solids) — Scoping

**Status: Stages 0-4 shipped.** Started as a staged plan only, per direct
request ("for the sake of completeness can you stage a plan"), following a
live design discussion: the wheel's own ★ symbol has been explicitly
retired from every real family and left free specifically for "a possible
future non-interactive non-convex stars category" — this is that
category, built for real. The explicit follow-up escalation — "I would
like to get the pinpoint accuracy to create them as beautiful as
possible... only the best possible effort on the last four shows the
standard throughout" plus "winding number aware triangulation etc" — is
what pushed this from a documented plan into real, numerically-verified
construction work rather than eyeballed/approximate coordinates. See
"Build postmortem" at the bottom for what that verification actually
found, including two real bugs it caught (one in the geometry
construction itself, one later in the face-fill triangulation).

A follow-up request ("the new ones can only be viewed small without
opaque or solid... would definitely like to push further") took the
originally-deferred face-fill work (see the old "Deferred" note, now
superseded below) and shipped it for real as Stage 4 — real Solid/
Translucent rendering using the winding-number-correct triangulation
that was only proven on paper in Stage 0.

**Still browsable only, never buildable — that boundary didn't move.**
The whole vertex/face-attach engine (`ShapeViewer.tsx`'s own
`triangulateFace`/`buildFaceGeometry`, `core.ts`'s `facesCongruent`,
every vertex-capacity/hover computation) still assumes every face is a
simple, non-self-intersecting convex polygon, and none of that code was
touched. Stage 4 gave star polyhedra their OWN real face-fill (a
separate, winding-number-aware triangulator — see `starTriangulation.ts`
— used only by the separate `StarShapeViewer.tsx`), not access to
`ShapeViewer`'s own triangulation. "Attach a shape to a pentagram face"
still has no well-defined flush-contact meaning the way it does for a
regular polygon, and making these 4 real attach targets would still mean
rethinking core assumptions used by every other family here — that part
is still out of scope, deliberately.

## The 4 Kepler-Poinsot solids

The complete, closed set — there are exactly 4, a settled 19th-century
classification, the star-polyhedron analogue of Zalgaller's own convex
classification this registry already cites for the Johnson solids.

| Solid | Schläfli | Vertices | Edges | Faces | Face shape | Density |
|---|---|---|---|---|---|---|
| Small stellated dodecahedron | {5/2, 5} | 12 | 30 | 12 | pentagram | 3 |
| Great dodecahedron | {5, 5/2} | 12 | 30 | 12 | pentagon | 3 |
| Great stellated dodecahedron | {5/2, 3} | 20 | 30 | 12 | pentagram | 7 |
| Great icosahedron | {3, 5/2} | 12 | 30 | 20 | triangle | 7 |

V/E/F and density are well-established published values (density = how
many times the faces wind around the center — the star-polyhedron
analogue of this registry's own real, computed V/E/F stats elsewhere,
included here for the same "show real geometric facts" reason
`ShapeStatsBlock` shows them for every other family). Two pairs are
exact duals of each other (small stellated dodecahedron ↔ great
dodecahedron; great stellated dodecahedron ↔ great icosahedron) — real
structure worth stating in each entry's own description, the same way
Catalan solids' own dual relationships are already documented.

## Construction method — verified computationally, not assumed

Every one of the 4 is derived from this registry's own already-validated
`DELTAHEDRA.D20` (icosahedron) and/or `PLATONIC_ADDITIONS.DODECAHEDRON`
vertex/edge/face data — never hand-typed coordinates, the same
"derive, don't duplicate" standard every other family here already holds
itself to. Each construction was checked with real numerical
verification (planarity, regularity, winding, vertex degree, triangle/
pentagon-count) before being written into `starPolyhedra.ts`, not
assumed from memory — this is what the user's explicit "winding number
aware triangulation etc" / "pinpoint accuracy" request actually required
in practice. The real per-solid construction, as implemented:

- **Great dodecahedron** — D20's own 12 vertices. Each vertex's 5 real
  icosahedron-neighbors are exactly coplanar and form one regular
  pentagon face (verified: max coplanarity deviation 0 to floating-point
  precision). All 12 such pentagons, connected in ordinary cyclic order.
- **Small stellated dodecahedron** — the SAME 12 vertices and the SAME
  5-vertex groupings as the great dodecahedron, connected in skip-one
  order (`[0,2,4,1,3]`) instead of plain cyclic order, turning each
  convex pentagon into a real regular pentagram.
- **Great icosahedron** — the SAME 12 D20 vertices again, reconnected via
  their "second-ring" neighbors: for each vertex, the 5 OTHER vertices at
  the second-nearest real distance shell (not the nearest/real-
  icosahedron-edge shell). Verified this adjacency graph contains exactly
  20 real equilateral triangles.
- **Great stellated dodecahedron** — genuinely different from the other
  3: **not** built from the registered `DODECAHEDRON`'s own vertices at
  all (an earlier attempt at that approach failed — see "Build
  postmortem" below for why). Instead it's the real polar dual of the
  great icosahedron built just above: one vertex per great-icosahedron
  FACE (the "pole" — that face's own outward normal, scaled by the
  reciprocal of the plane's distance from center) and one face per
  great-icosahedron VERTEX (the 5 poles of the 5 great-icosahedron faces
  meeting at that vertex, connected in the same skip-one order). Verified
  all 20 poles equidistant from center, every face-loop edge exactly the
  same length, every vertex degree exactly 3.

Every construction is unit-edge-normalized via the registry's own
`makeSpec` (not `makeSpecByCircumradius` — unlike Catalan solids, every
star-polyhedron face here genuinely does have one uniform edge length,
so the simpler, more common normalization applies directly).

## Why `PolyhedronSpec`/`ShapePreview` already do most of the real work

`ShapePreview.tsx` (the shared wireframe renderer behind every
`ShapePreviewCard`, `ShapeDetailDrawer`, and Compare thumbnail) is a
plain 2D `<canvas>` orthographic projection of `spec.vertices`/
`spec.edges` — **not** Three.js, and critically, not face-filling at
all (see that file's own header comment for why: dozens of
simultaneous WebGL contexts in a Search grid isn't viable, so it draws
stroked edges only). A star polyhedron's EDGES are perfectly ordinary
straight line segments between two real vertices — nothing
self-intersecting about an edge itself, only a filled star FACE is
self-intersecting. That means real, correct-looking wireframe previews
of all 4 solids need **zero new rendering code** once real
vertices/edges exist — the hard problem (face triangulation) was real,
but deferred to Stage 4 rather than solved here, and only ever mattered
for `ShapeViewer.tsx`'s own solid 3D view, which these are still
explicitly never opened in (Stage 4 built its OWN separate face-filler
instead — see below).

**Real limitation, not just a simplification:** `ShapePreview` only
auto-spins (`spin?: boolean`) — it has no drag/pointer handling at all,
so cards and the detail drawer alone would only ever show a fixed or
auto-rotating angle, never free user-driven 3D rotation the way
`ShapeViewer`'s own `OrbitControls`-driven view gives every other
shape. Real 3D drag-to-rotate for these 4 needed its own small dedicated
component (Stage 2 below) — genuinely separate from both `ShapePreview`
(2D canvas, auto-spin only) and `ShapeViewer` (solid-triangulated via a
convex-only algorithm, still correctly never opened for these 4) — not a
free side effect of adding the data.

`faces: number[][]` (`PolyhedronSpec`'s own field) still gets populated
with each solid's real per-face vertex-index list (e.g. a pentagram
face's own 5 non-adjacent vertices, in "connect every 2nd point"
order) purely so `faceTypeSortKey`/`ShapeStatsBlock`'s face-count stat
keep working structurally — `.length` on a 5-index array is still 5
whether the polygon it describes is convex or a star, so nothing
downstream needs special-casing for that alone.

## Registry/family integration — deliberately OUTSIDE families.ts

Star polyhedra do **not** become an 8th `FamilyKey` in
`app/lib/polyhedra/families.ts` — that file is the wheel's own single
source of truth (`FAMILY_ORDER` drives `PolyhedralWheel`'s real
face-attach-capable family list directly), and these must never appear
there or they'd silently become "buildable" the moment anything reads
`FAMILY_ORDER`. Instead:

- `app/lib/polyhedra/starPolyhedra.ts`: the 4 specs, built via `makeSpec`,
  exported as their own small `STAR_POLYHEDRA: Record<string,
  PolyhedronSpec>` plus `STAR_POLYHEDRON_IDS` and `STAR_POLYHEDRON_META`
  (Schläfli/density) — parallel to, but never merged into, the main
  `POLYHEDRA` registry `PolyhedralWheel`/face-attach code reads from.
- `app/lib/polyhedra/lookup.ts` (new): `getAnySpec(id)` (checks
  `POLYHEDRA` then `STAR_POLYHEDRA`) and `isStarPolyhedron(id)` — a
  rendering-path-only lookup used by every display component
  (`ShapePreview`, `ShapePreviewCard`, `ShapeStatsBlock`,
  `ShapeDetailDrawer`, `CompareScreen`). Every attach-path file
  (`ShapeViewer.tsx`, `PolyhedralWheel.tsx`, `core.ts`) keeps reading
  `POLYHEDRA` directly and was **not touched** — this is the actual
  mechanism that keeps star polyhedra structurally unreachable from
  attach code, not a convention someone has to remember.
- `FullCatalogScreen.tsx` gained a trailing "★ Star Polyhedra — reference
  only" section after the real `FAMILY_ORDER.map(...)` loop, using the
  same `ShapePreviewCard` grid. Skipped entirely whenever Full Catalog is
  opened as an attach-flow picker (`filterIds` set) — none of the 4 could
  ever be a valid attach target.
- `ShapeDetailDrawer.tsx`: "Add to Scene" is replaced by a real
  explanatory pill ("Reference only — not buildable (self-intersecting
  star faces)", `i18n.ts`'s `star.referenceOnly` key, translated in all
  4 languages) for these 4 ids specifically, and the preview slot renders
  `StarShapeViewer` (Stage 2, renamed from `StarWireframeViewer` once
  Stage 4 gave it real fills too) instead of the static `ShapePreview`.
- `app/lib/polyhedra/starTriangulation.ts` (new, Stage 4): a real,
  numerically-verified triangulator for these 4 solids' own faces --
  winding-number-correct for pentagram faces, plain fan for the 2 solids
  whose faces are simple. Used only by `StarShapeViewer.tsx`; `core.ts`'s
  own `triangulateFace` (assumes convex) was never touched.
- `ShapeStatsBlock.tsx`: shows a Schläfli/density line for these 4 ids
  (`STAR_POLYHEDRON_META`) in place of the empty family-membership line
  (star polyhedra belong to no `FamilyKey`).
- `SearchScreen`'s family filter chips stay untouched (7 real families,
  unchanged) — these are reachable only via the new Full Catalog
  section, never via family search filtering, consistent with "not a
  real family."

## Staged implementation

### Stage 0 — Data module, verified geometry — SHIPPED
`starPolyhedra.ts` + `scripts/validate-star-polyhedra.ts` (`npm run
validate:star`): real vertex/edge/face data for all 4 solids, checked
against the published V/E/F/density/Schläfli table, unit-edge
regularity across every edge (not just each face loop), and an
independent outward-winding re-check that doesn't trust the
construction code's own `ensureOutward` step. All 4 pass cleanly.

### Stage 1 — Reachable, read-only, in Full Catalog — SHIPPED
Wired into `FullCatalogScreen.tsx`. Real wireframe previews confirmed
screenshot-verified (not just assumed from the "ShapePreview is
edge-only" reasoning above) — clicking a card opens `ShapeDetailDrawer`
with "Add to Scene" absent and a real explanatory pill in its place.
E2e coverage: `tests/e2e/star-polyhedra.spec.ts`.

### Stage 2 — a real 3D drag-rotate viewer — SHIPPED
`ShapePreview`'s auto-spin-only limitation (noted above) needed its own
small component (originally `StarWireframeViewer.tsx`, since renamed --
see Stage 4): a dedicated `THREE.Scene`/`WebGLRenderer`/`OrbitControls`
view rendering ONLY `THREE.LineSegments` over `spec.edges` (real
wireframe geometry, no `BufferGeometry` face mesh at all) — at the time,
sidestepped the star-face triangulation problem entirely by not needing
one. Auto-rotates until the user's first drag (an `OrbitControls`
`'start'` listener flips `autoRotate` off permanently at that point, so
it never fights the user's own angle), then stays under full user
control — `enableDamping` for real inertia, zoom bounded, panning
disabled. Opened from `ShapeDetailDrawer` in place of the static/
auto-spin `ShapePreview` for these 4 ids specifically. Verified
end-to-end: dragging the canvas genuinely changes the rendered frame
(`tests/e2e/star-polyhedra.spec.ts`'s own drag-rotation test), not just
that a canvas element exists.

### Stage 3 — Stats and identity — SHIPPED (folded into Stage 1)
`ShapeStatsBlock.tsx` shows density and Schläfli symbol for these 4 ids
specifically, in place of the (empty, since they belong to no
`FamilyKey`) family-membership line — real information specific to this
family that the other 7 don't have, not decoration. Cheap enough to ship
alongside Stage 1 rather than as a separate pass.

### Stage 4 — real Solid/Translucent fills — SHIPPED
The originally-deferred face-fill work, done for real: `app/lib/
polyhedra/starTriangulation.ts` triangulates each face's own actual fill
region (not an approximation) --
- **Simple faces** (great dodecahedron's pentagons, great icosahedron's
  triangles): detected by checking whether the face's own non-adjacent
  edges genuinely cross in its own plane; if not, plain fan
  triangulation (same pattern as `core.ts`'s `triangulateFace`, just
  returning real points instead of vertex indices).
- **Pentagram faces** (small/great stellated dodecahedron): each of the
  5 star edges is crossed by exactly 2 others, giving 5 real intersection
  points (the inner pentagon's own corners) and splitting each edge into
  an outer-near-start / outer-near-end pair. Triangulated as 5 outer
  "tip" triangles + a 3-triangle fan of the inner pentagon (8 triangles
  total) -- the same algorithm already proven identical to the star's
  true nonzero-winding-number fill via dense random-point sampling
  (160,801 points, 0 mismatches -- see the earlier coverage proof above),
  re-verified here at 200×200 density per real face against the actual
  registry data (24 pentagram faces total, 0 coverage mismatches -- see
  `scripts/validate-star-triangulation.ts` / `npm run
  validate:star-triangulation`). That real-data re-run is also where a
  genuine winding bug turned up -- see "Stage 4 postmortem" below.

`StarWireframeViewer.tsx` was renamed to `StarShapeViewer.tsx` and
extended with a local Wireframe/Solid/Translucent mode toggle (own
component state, not `ShapeViewer`'s `ViewMode` prop) -- mode changes
only ever touch material properties (`opacity`/`transparent`/
`depthWrite`), never rebuild the scene, so toggling modes doesn't reset
whatever angle the user has already dragged to. Defaults to Solid.
Screenshot-verified for all 4 solids in all 3 modes; e2e coverage:
`tests/e2e/star-polyhedra.spec.ts`'s mode-toggle test.

**Still deferred / explicitly out of scope:** making any of the 4
attachable (vertex or face) -- would mean redefining what "flush
contact" means for a self-intersecting face, genuinely different and
much larger than a rendering problem. `StarShapeViewer` is a real,
separate, read-only viewer; it was never merged into `ShapeViewer` and
none of the attach-path files were touched.

## Open questions

- Whether a Home-screen shelf (alongside Recents/Favorites) is worth
  adding for discoverability, or Full Catalog's own new section is
  sufficient — not decided here; shipped with Full Catalog only, revisit
  only if that alone doesn't surface them.

## Build postmortem — the real difficulty in this build

The genuinely hard part of this feature was **not** the self-intersecting
star faces (settled early, numerically: 5 point-triangles + a
fan-triangulated inner pentagon is provably identical to a true
nonzero-winding-number fill of a regular pentagram, checked against
160,801 sampled points with zero mismatches — this only matters if/when
these solids are ever face-filled, which they deliberately aren't yet,
but it was worth settling for real rather than asserting since the
question came up directly). The real difficulty was a **wrong structural
assumption in the great stellated dodecahedron's construction**:

**What went wrong.** The first attempt built great stellated dodecahedron
faces by taking the registered `DODECAHEDRON`'s own 12 pentagon face
loops and reconnecting each one's 5 vertices in skip-order
(`[0,2,4,1,3]`) independently, per face — the same transform that
correctly turns great dodecahedron's pentagons into small stellated
dodecahedron's pentagrams. `scripts/validate-star-polyhedra.ts` caught
it immediately: **60 unique edges instead of the expected 30.**

**Why.** Great dodecahedron/small stellated dodecahedron/great
icosahedron all build their face groupings from one SHARED vertex-
neighbor structure computed once (D20's own edge list, or its distance
shells) — vertex-neighbor relationships are inherently symmetric, so
adjacent faces built from that shared structure naturally end up sharing
edges. Reconnecting `DODECAHEDRON.faces` per-face instead builds each
pentagram's 5 "diagonal" edges purely from that ONE face's own local
vertex list — internal to that face, never shared with any neighboring
face's own independently-computed diagonals. 12 faces × 5 edges with zero
sharing is exactly 60, not 30. Real structural bug, not a rounding or
floating-point issue — the diagnostic script's distance-shell dump on
`DODECAHEDRON` (matching its own real, already-registered edges exactly)
confirmed the base data was fine; the bug was purely in how faces were
grouped.

**The fix.** Verified computationally (not guessed) that great stellated
dodecahedron's real vertices are the polar dual of the great
icosahedron's 20 face planes — NOT the plain dodecahedron's own 20
vertices at all (checked directly: the dual "pole" directions do not
match the dodecahedron's own vertex directions, confirming this by
elimination too). Rebuilt per the "Construction method" section above
using the great icosahedron's own already-correct 20 faces and 12
vertices' worth of face-incidence — this is what's shipped. Full
regularity/degree/edge-count re-verified after the fix (all 4 solids: `npm
run validate:star` → OK).

**Takeaway for the next self-intersecting/stellated construction in this
registry:** shared adjacency structure (a neighbor graph, distance
shells) generalizes to a stellation; reusing an existing family's own
per-face vertex ordering does not, even when the vertex COUNT happens to
match. The published V/E/F table (checked here, not skipped) is what
actually caught this — a strong argument for always writing the
cross-check script before trusting a construction "looks right" from a
screenshot alone.

### Stage 4 postmortem: a winding bug the original proof didn't cover

The pentagram face-fill algorithm (5 tip triangles + a 3-triangle inner
fan) was numerically proven *before* being written into
`starTriangulation.ts` -- 160,801 randomly sampled points checked against
the true nonzero-winding-number fill, 0 mismatches (the same proof cited
above). That proof only checked **coverage** (is a given point inside the
filled region or not), which is orientation-agnostic: it can't tell a
correctly-wound triangle from one with its vertices listed backward,
since a triangle's fill *area* doesn't depend on winding order.

`scripts/validate-star-triangulation.ts` added a check the original proof
never had: comparing each triangle's own computed normal against its
face's outward normal, run directly against the real registry data (not
the idealized flat pentagon the algorithm was first proven on). It failed
immediately -- every one of the 5 tip triangles per pentagram face (120
total across both pentagram-faced solids) was wound backward, i.e.
pointing inward. The 3 inner-fan triangles were fine.

**Why the area check missed it, and the fix.** `pointInTriangle` (used by
the original sampling proof) is winding-independent by construction --
swapping any two triangle vertices doesn't change what area it covers,
only which way it faces. The tip-triangle vertex order
`[tip, nearFromIncoming, nearFromOutgoing]` happened to trace the
triangle the opposite way around from the already-correct inner-fan
order. Fixed by swapping to `[tip, nearFromOutgoing, nearFromIncoming]`
-- re-verified against real 3D face data afterward (not just the
idealized flat pentagon this bug had been hiding in), all 4 solids now
pass every check including a full re-run of the dense nonzero-winding
sampling directly on real per-face geometry.

**Takeaway:** a coverage/area proof and a winding/orientation proof are
different claims -- proving one doesn't imply the other, and a rendering
pipeline cares about both (wrong winding means backward normals, which
mean wrong lighting and, with backface culling on, invisible faces).
When verifying a triangulation meant for real 3D rendering, check
winding explicitly; don't assume an area-only proof covers it.
