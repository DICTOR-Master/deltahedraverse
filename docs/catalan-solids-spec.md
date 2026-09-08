# Catalan Solids — Scoping

The 13 Catalan solids are the exact face/vertex duals of the 13
Archimedean solids — every one of which is already in this registry,
verified (`app/lib/polyhedra/archimedean.ts`). Scoped as the next family
after the Johnson solids finish, per direct user request (2026-09-08),
prompted by a question worth recording the answer to: is
Platonic+Archimedean+Johnson+deltahedra already the complete list of
convex polyhedra with regular polygonal faces? Yes — Zalgaller proved in
1969 that 5 Platonic + 13 Archimedean + the infinite prism/antiprism
families + 92 Johnson solids is the complete, closed classification.
Catalan solids are a genuinely different category, not a missing entry
in that one: they're face-transitive (not vertex-transitive) duals with
congruent but **irregular** faces. That's the source of every
architectural question below.

## The 13, with their Archimedean duals

| Catalan solid | Dual of | Faces | Face shape | V / E | Chiral? |
|---|---|---|---|---|---|
| Triakis tetrahedron | Truncated tetrahedron | 12 | isosceles triangle | 8 / 18 | no |
| Rhombic dodecahedron | Cuboctahedron | 12 | rhombus | 14 / 24 | no |
| Triakis octahedron | Truncated cube | 24 | isosceles triangle | 14 / 36 | no |
| Tetrakis hexahedron | Truncated octahedron | 24 | isosceles triangle | 14 / 36 | no |
| Deltoidal icositetrahedron | Rhombicuboctahedron | 24 | kite | 26 / 48 | no |
| Disdyakis dodecahedron | Truncated cuboctahedron | 48 | scalene triangle | 26 / 72 | no |
| Pentagonal icositetrahedron | Snub cube | 24 | irregular pentagon | 38 / 60 | **yes** |
| Rhombic triacontahedron | Icosidodecahedron | 30 | rhombus | 32 / 60 | no |
| Triakis icosahedron | Truncated dodecahedron | 60 | isosceles triangle | 32 / 90 | no |
| Pentakis dodecahedron | Truncated icosahedron | 60 | isosceles triangle | 32 / 90 | no |
| Deltoidal hexecontahedron | Rhombicosidodecahedron | 60 | kite | 62 / 120 | no |
| Disdyakis triacontahedron | Truncated icosidodecahedron | 120 | scalene triangle | 62 / 180 | no |
| Pentagonal hexecontahedron | Snub dodecahedron | 60 | irregular pentagon | 92 / 150 | **yes** |

Only **2 of the 13** (rhombic dodecahedron, rhombic triacontahedron)
have uniform edge length — a rhombus's 4 sides are equal by definition.
The other 11 have 2 or 3 distinct edge lengths per face. This is the
central fact this whole scoping document is organized around: it breaks
two assumptions this registry has relied on since the very first
deltahedron.

## Construction method: polar dual, not independent coordinates

Every Catalan solid can be derived directly from its already-registered
Archimedean dual via polar reciprocation about the **midsphere** (the
sphere tangent to every edge — every Archimedean solid has one, at a
computable radius): each Archimedean **face** centroid, projected
outward to the midsphere and reciprocated (`v' = v * r_mid² / |v|²`),
becomes a Catalan **vertex**; each Archimedean **vertex** becomes a
Catalan **face**, whose boundary is the (cyclically ordered) set of
Catalan vertices dual to the Archimedean faces meeting at that vertex.

This is a real, checkable construction, not a hand-wave — and it means
**no new golden-ratio/trigonometric coordinate derivation is needed for
any of the 13**. This project's own precedent already validates the
approach: `TRUNCATED_ICOSAHEDRON` and `J6_PENTAGONAL_ROTUNDA` were both
derived from an already-verified registry shape rather than independent
coordinates, and both held up under the full verify suite. Every
Catalan solid should get the same self-check discipline established in
batches 5/7 (rebuild something already known and compare): the
midsphere-reciprocation of `CUBOCTAHEDRON`, for instance, should be
checked against published rhombic-dodecahedron vertex data (or, more in
this project's own style, checked for the properties a rhombic
dodecahedron is *known* to have — 12 congruent rhombic faces, uniform
edge length, 8 degree-3 + 6 degree-4 vertices — via `scipy.spatial.
ConvexHull` and a diagonal/angle check per face, exactly like every
batch since batch 8's lesson) before being trusted.

## What has to change in this codebase — and what doesn't

**Vertex-attach (ball-joint) mode should need no changes.** It only
cares about vertex degree/capacity, not face shape.

**`makeSpec`'s normalization breaks for 11 of 13.** It currently
measures `edges[0]`'s length and divides every vertex by it, asserting
(implicitly, via `validateShape`) that this yields a *uniform* unit
edge everywhere. For a triakis tetrahedron's isosceles triangles, "the
first edge" could be either of two different lengths depending on
which edge happens to be listed first — silently producing a shape at
the wrong overall scale relative to its own irregular faces, not
merely differently-scaled but *internally inconsistent* if the wrong
reference edge is used inconsistently across vertices. Needs a
genuinely different normalization convention. **Decided (2026-09-08):
circumradius = 1, computed per shape** (distance to the farthest
vertex) — see "Normalization convention, decided" below for the
empirical case. `validateShape`'s edge-length assertion needs the same
rethink: check that each face's edges match its *own* face-type's
expected length pattern (e.g. "this isosceles triangle's two long edges
are equal to each other and its one short edge matches every other
short edge in the shape"), not a single global constant.

**Face-attach's discrete registration count is hardcoded to the face's
own vertex count**, assuming n-fold rotational symmetry
(`ShapeViewer.tsx`: `pending.registration = (pending.registration + 1)
% pending.faceSize`, `angle = registration * 2π / faceSize`) — correct
only for a regular n-gon. A Catalan face's *true* rotational symmetry
order is much lower:
- rhombus: 2-fold (180°) — 2 valid registrations
- isosceles triangle: 1-fold (only mirror symmetry, not rotational) — 1 registration
- kite: 1-fold (mirror only) — 1 registration
- scalene triangle: 1-fold (no symmetry at all) — 1 registration
- irregular pentagon (the two chiral solids): 1-fold — 1 registration

This needs a genuine generalization: compute each face's own rotational
symmetry order from its actual geometry (or, more simply, store it
per face-type, since it's a fixed property of "isosceles triangle" vs.
"rhombus" etc., not something that needs runtime discovery), and use
*that* instead of `faceSize` for both the registration count and the
angle-per-step. A face with only 1 valid registration still supports
face-attach — it just doesn't rotate; the discrete-step interaction
degenerates to "there's exactly one way this glues on," which is a
real, useful case already (a scalene-triangle-faced piece has a single
correct orientation once placed).

**The wheel, dual classification, and everything else in
`PolyhedralWheel.tsx`** should extend the same way batches 1-9 already
did — a new `CATALAN_ADDITION_IDS` list, a new family entry, sorted by
whatever face-type-and-count convention (or a new one, since "face
type" here means "isosceles triangle" not "triangle" — worth deciding
whether the wheel should distinguish those or just group by vertex
count the way it already does).

## Proposed order

1. **Rhombic dodecahedron and rhombic triacontahedron first** — the 2
   uniform-edge cases need *no* `makeSpec`/`validateShape` changes at
   all, just the face-attach registration generalization (2-fold, not
   n-fold). Lowest-risk way to prove the polar-dual construction method
   and land the registration-count generalization before touching
   normalization.
2. **The 8 non-chiral, non-uniform-edge solids** (triakis tetrahedron/
   octahedron/icosahedron, tetrakis hexahedron, pentakis dodecahedron,
   deltoidal icositetrahedron/hexecontahedron, disdyakis dodecahedron/
   triacontahedron) — this is where the circumradius-normalization
   change actually lands, batched by face-type the same way Johnson
   solids were batched by construction family.
3. **The 2 chiral solids last** (pentagonal icositetrahedron/
   hexecontahedron) — same chirality considerations already on record
   for the snub Archimedean solids and batch 5's gyroelongated Johnson
   solids (only one handedness stored; a mirror-image toggle is a
   separate, already-flagged gap).

## Normalization convention, decided: circumradius = 1, per shape

Three candidates were checked empirically against real geometry (this
registry's own already-verified Archimedean solids, reciprocated),
not decided by argument alone:

1. **Insphere radius = 1** (the cleanest *definition* — every Catalan
   solid is face-transitive, so its insphere radius is always a single,
   unambiguous value, unlike circumradius, which is genuinely messier
   for these shapes: most Catalan solids aren't vertex-transitive, so
   "circumradius" really means "distance to the farthest of 2-3 vertex
   classes at different radii," not one clean number). Rejected anyway:
   picking insphere = 1 makes each solid's *edge length* land wherever
   that particular shape's own insphere/circumradius ratio happens to
   put it, with no consistency across the family.
2. **A single global "skewed insphere" constant**, tuned toward the
   *average* insphere/circumradius ratio across several Catalan solids,
   as a compromise attempt to keep insphere's clean definition while
   approximating circumradius-like consistency. Measured the actual
   ratio for 4 different solids — 0.707 (rhombic dodecahedron), 0.851
   (rhombic triacontahedron), 0.863 (deltoidal icositetrahedron), 0.522
   (triakis tetrahedron). That's real, substantial spread, not noise:
   a constant tuned to the average (~0.735) leaves the best case only
   ~4% off circumradius-consistency but the worst case (triakis
   tetrahedron) ~41% off — oversized enough to look conspicuously wrong
   next to the others in the same wheel. Rejected.
3. **Trusting each Catalan solid's own natural scale** — no explicit
   normalization step at all, just the coordinates that fall out of
   reciprocating about the shared midsphere the polar-dual construction
   already uses (a real fact: primal and canonical dual share the same
   midsphere). Checked the resulting *raw* edge length against 1 for 4
   solids: rhombic dodecahedron 0.919 (8% off), rhombic triacontahedron
   1.063 (6% off), deltoidal icositetrahedron 0.84-1.08 (up to 16%
   off) — genuinely close, a near-free-lunch for these three. But
   triakis tetrahedron's raw edges came out 1.8-3.0 (80-200% off) —
   truncated tetrahedron (its dual) has two very differently-sized face
   types (triangles and hexagons) at quite different centroid distances
   from center, so the shared-midsphere scale that works well for the
   more uniform Archimedean solids swings far off for this one.
   Rejected — the same "usually close, unreliably so" problem as
   option 2, for a different underlying reason.

**Decision: circumradius = 1, computed and applied per shape** —
distance to the farthest vertex, normalized to exactly 1, individually
for each of the 13. This is the only one of the four approaches tried
that *guarantees* consistent visual scale across the whole family and
against the rest of the registry, rather than approximating it well
for some shapes and badly for others. It costs nothing in
implementation complexity over the rejected alternatives — `makeSpec`
already computes one per-shape reference length for every other family
(currently "the first edge"); this is the same pattern, just measuring
farthest-vertex distance instead.

## UI affordance for 1-registration faces — decided: none dedicated, reuse the existing registration counter

Considered a dedicated "no rotation available for this face" affordance
for the 11 of 13 Catalan solids whose faces have only 1 valid
registration (everything except the 2 rhombic solids' 2-fold faces).
Argued both directions rather than assumed:

**Against a dedicated affordance**: `ShapeViewer.tsx` already shows a
live `registration X/N` label during any face-attach drag. Once `N` is
generalized to each face's real symmetry order (this doc's earlier
section) rather than assumed equal to vertex count, a 1-registration
face just shows `registration 1/1` — the same informational pattern a
user already learns from a square wrapping `4/4 → 1/1`, not a new
concept. A bespoke banner would also fire on the *majority* of Catalan
face-attaches (11 of 13 solids are 1-fold), risking becoming ignorable
noise rather than a meaningful signal.

**For one, and decisive**: that argument only holds if the registration
counter is genuinely visible throughout *every* face-attach drag,
including 1-registration ones — not just shown once a multi-step cycle
is in progress. If the current drag interaction gives no visible
feedback at all until a registration count above 1 exists, a user
dragging on a 1-registration face sees nothing move and has no counter
on screen to explain why. That's the real gap, and it settles the
question.

**Decision**: no dedicated new UI affordance. Ensure (verify during
implementation, don't assume) that the existing registration-count
label is shown for every pending face-attach the moment it's placed —
before any drag input, not only once dragging begins — so a
1-registration face reads as `registration 1/1` immediately and
correctly, the same mechanism as every other face-attach, rather than
a special case.

Both open questions from the initial scoping are now resolved.
Implementation hasn't started — everything to date (2026-09-08) has
been scoping and decision-making, as asked.
