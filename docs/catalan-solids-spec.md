# Catalan Solids — Scoping

**Status (2026-09-09): all 13 are done.** See the batch 1/2/3 sections
below for the full build record — this doc also serves as the
authoritative postmortem for the family, not just its original
scoping.

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

### A real consequence of independent per-shape normalization, and the fix

Since each Catalan solid is normalized to ITS OWN circumradius = 1 in
isolation, two different Catalan solids' faces essentially never match
in absolute size, even on the rare occasion two of them might share the
same face *proportions* (same interior-angle sequence) — independent
normalization doesn't know or care that a shared face type exists.
Checked directly against the first 2 shapes added
(`RHOMBIC_DODECAHEDRON`, `RHOMBIC_TRIACONTAHEDRON`): their rhombi are
NOT actually the same shape (diagonal ratio sqrt(2) vs. phi — genuinely
different proportions, not just different sizes), so this doesn't apply
to them, but it's a real design question for the remaining 11.

**Rule for future batches**: circumradius = 1 stays the default
normalization for any new Catalan solid. But before applying it, check
whether the new solid's face type has IDENTICAL proportions (matching
interior-angle sequence, not just matching vertex count) to a face type
already in the registry. If so, normalize the new solid to match that
existing shape's edge length instead of independently hitting its own
circumradius = 1 — preserving genuine face-attach compatibility between
the two, rather than leaving it broken by an avoidable scale mismatch.
This solves the problem upstream, at normalization time, rather than
needing any runtime rescaling logic in the face-attach code itself. Not
yet exercised by any shape pair (the first 2 don't share proportions) —
apply it the first time it actually matters, not preemptively with no
real pair to verify it against.

### Face-attach compatibility needs a genuine congruence check, not vertex-count matching

A more immediate, already-relevant finding: `ShapeViewer.tsx`'s
existing face-attach compatibility check only compares vertex count
(`targetFaceSize === incomingFace.length`) — correct for every
regular-faced family so far (any two same-vertex-count faces there
already ARE the same regular polygon), but wrong once irregular faces
exist: a rhombus and a kite can both have 4 vertices without being the
same shape at all. Fixed with `facesCongruent()` in `core.ts`, checking
each face's own edge-length AND interior-angle sequence against the
other's under every cyclic rotation — reduces to the old
vertex-count-only behavior automatically for every regular-faced shape
already in this registry, so this is a strict generalization, not a
special case. A first version of this function also accepted a REVERSED (mirrored)
winding as a valid match, reasoning that flipping which way an incoming
piece presents its face was a valid physical option — reverted since
the actual attach transform only ever computes a rotation, never a
reflection, so offering a mirror-only match as "compatible" would
promise something the real code couldn't deliver. Rotation-only is
correct, but this turned out NOT to be the cause of the bug that
motivated removing it (see below) — worth keeping the fix anyway on its
own logic, but the real bug needed a separate diagnosis.

### The real bug: face-vertex-list starting point wasn't a consistent geometric role

After the reflection fix above, `verify-face-attach.ts` still failed
identically at the exact same 448 (of 1,978,657) checks:
`RHOMBIC_TRIACONTAHEDRON` attaching to a second copy of itself, always
at specific face-index pairs. Since `facesCongruent` was matching these
pairs via pure rotation (no reflection needed — every one of its 30
faces is the same rhombus) and face winding was independently confirmed
consistent (every face's `dot(centroid, normal) > 0`, correctly
outward-facing), neither hypothesis explained it. The actual cause:
`computeFaceAttach`'s twist angle is computed by aligning the incoming
face's "vertex 0" direction to the target face's "vertex 0" direction —
this only produces a correct alignment if vertex 0 plays the *same
geometric role* on every face. For a regular n-gon every vertex is
interchangeable, so this was always trivially true before Catalan
solids existed. For a rhombus, vertex 0 can land on either an acute
(63.4°) or an obtuse (116.6°) corner depending on which vertex the
hull-merge angle-sort happened to start at for that particular face —
confirmed directly by printing the interior angle at vertex 0 across
all 30 faces of `RHOMBIC_TRIACONTAHEDRON`, which showed exactly this
mix. **Fix**: canonicalize every face's vertex list to start at its own
acute corner before it ships in the registry (a one-off transform
applied to `FACES_RHOMBIC_TRIACONTAHEDRON`'s literal data in
`catalan.ts`, not a runtime step — `RHOMBIC_DODECAHEDRON`'s faces
happened to already be consistent, verified rather than assumed).
`verify-face-attach.ts` passed cleanly (0/1,978,657) after this fix.
**General rule for the remaining 11 Catalan solids**: any face-vertex
list needs its starting vertex canonicalized to a consistent geometric
role (e.g. "the acute corner," or whatever role fits that face's own
shape) before trusting index-0-to-index-0 alignment anywhere — true for
any irregular polygon, not specific to rhombi, and easy to miss because
it passes every check except the exhaustive cross-shape one.

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

## Batch 1 done (2026-09-08/09): rhombic dodecahedron + rhombic triacontahedron

The 2 uniform-edge solids, as planned. Full record already covered
above and in `docs/build-plan.md` — includes the vertex-0
canonicalization bug found and fixed on `RHOMBIC_TRIACONTAHEDRON`
(each face needing a consistent starting-vertex geometric role, not
just consistent edges).

## Batch 2 done (2026-09-09): the 9 non-chiral, non-uniform-edge solids

Triakis tetrahedron/octahedron/icosahedron, tetrakis hexahedron,
pentakis dodecahedron, deltoidal icositetrahedron/hexecontahedron,
disdyakis dodecahedron/triacontahedron — all 9, via the same polar-
reciprocation construction as batch 1. First real exercise of
`makeSpecByCircumradius` for shapes that actually NEED it (batch 1's 2
rhombi happened to have uniform edges despite not needing the
circumradius approach). Confirmed before trusting it for any of the 9:
every Archimedean base used here has all its edge midpoints at
EXACTLY the same distance from center (checked directly, not assumed
— the midsphere is a real, well-defined feature of this registry's own
coordinate data for all 8 non-edge-transitive Archimedean bases used,
not just the 2 edge-transitive ones batch 1 happened to use).

Every one of the 9 passed `validateCatalanShape` cleanly: single
edge-length signature across all faces (true congruence), uniform
insphere, exact V/E/F match to the standard table. Checked (per the
user's own question, asked mid-batch): do any of these 9 share face
proportions with each other or with batch 1's 2 rhombi, requiring the
"match an existing shape's scale" rule from the normalization section
above? No — every isosceles-triangle, kite, and scalene-triangle pair
across all 11 Catalan solids built so far has genuinely different
proportions (checked by normalizing each face's own side ratios).
That rule is written and ready but still hasn't fired even once.

**The vertex-0 canonicalization fix from batch 1 was needed again,
generalized to more complex face shapes.** Every one of these 9 faces
(isosceles/scalene triangles, kites) had the same "vertex 0 plays an
inconsistent geometric role across faces" problem `RHOMBIC_TRIACONTAHEDRON`
had — checked directly before accepting any of them, not assumed to
be fine just because batch 1's fix existed. The simple "start at the
acute corner" rule from the rhombus case doesn't generalize to
triangles or kites, so a more general rule was used instead: start
each face at whichever vertex's own interior angle is (a) least
frequent among that face's own angle values (isolating an isosceles
triangle's apex, or either "point" of a kite, from the repeated
angles) and (b) among any remaining ties, the largest such angle.
Confirmed this reduces every one of the 9 shapes to exactly ONE
consistent angle value at vertex 0 across all its faces before
trusting it — not assumed to generalize just because it worked for
one shape. This mattered MORE here than for the rhombic
triacontahedron: every face in this batch has `faceRotationalSymmetry`
of exactly 1 (no non-identity rotation preserves an irregular triangle
or kite), so there's no fallback registration to mask a wrong
vertex-0 choice the way a rhombus's 2-fold symmetry could.

## A second, deeper architectural fix found in this batch: `facesCongruent` needed reversed matching, not direct

After the vertex-0 fix, all 11 Catalan solids passed `validateCatalanShape`
and the initial `verify:face-attach` run still failed — 8352 of
3,338,241 checks, all on `DISDYAKIS_TRIACONTAHEDRON` (dual of the
truncated icosidodecahedron, 120 scalene-triangle faces). This is the
first face type in the whole registry with **zero symmetry of its own**
— not just no rotational symmetry (already true of every isosceles
triangle and kite in this batch), but no REFLECTIVE symmetry either: a
scalene triangle is genuinely chiral as a 2D shape.

Diagnosed by brute-force search over every possible twist angle for a
self-attach case (`DISDYAKIS_TRIACONTAHEDRON[f119]` to a second copy
of itself at the identical face): no angle came within 0.33 units of
exact coincidence — a real geometric impossibility, not a precision
issue. Worked out why from first principles, then verified
computationally rather than trusting the derivation alone: opposing
two faces' outward normals (required for any face-attach, so the
incoming piece grows away from the target rather than into it) means
the two faces, viewed from a single fixed external vantage point, are
inherently related as **mirror images**, not direct copies — for
achiral face shapes (everything in this registry before this batch),
a shape's mirror image is reachable via rotating the shape itself, so
this was invisible; a genuinely chiral face makes it visible for the
first time. Confirmed directly: `DISDYAKIS_TRIACONTAHEDRON` has
exactly 60 faces whose edge-length pattern is the REVERSE of `f119`'s
(a real "mirror partner" set, not a hypothesis) — attaching `f119` to
one of those 60 (face 0), using the *exact same, unmodified*
`computeFaceAttach` transform, coincides to within 1e-16.

**Fix**: `facesCongruent` (`core.ts`) now checks face B's edge-length
and interior-angle sequence in REVERSED order against face A's direct
sequence (previously checked B's direct order) — see the function's
own updated doc comment for the full derivation and why this changes
nothing for every achiral face type already in the registry (confirmed
by the complete `verify:face-attach` suite staying at 0 failures
across all 135 shapes after the fix, not just the newly-fixed ones).
This corrects an earlier, related investigation from batch 1: a first
version of `facesCongruent` DID check the reversed sequence too (as an
OR alongside direct matching), removed after `RHOMBIC_TRIACONTAHEDRON`
kept failing identically with or without it — that removal was correct
FOR THAT CASE (rhombi are achiral, so reversed matching was genuinely
redundant there; the real bug was the vertex-0 inconsistency), but the
underlying reasoning ("the transform can't reflect, so never offer a
reversed match") turned out to be incomplete, not fully wrong: the
transform indeed never reflects, but exactly BECAUSE of that, the
correct match criterion for what it CAN achieve is the reversed
sequence, not the direct one, for a chiral face.

**Relevant for the 2 chiral Catalan solids still to come** (pentagonal
icositetrahedron/hexecontahedron, dual of the snub cube/dodecahedron):
their irregular-pentagon faces are also chiral (no reflective
symmetry), so this same fix — not a new one — should already cover
them. Worth confirming directly when building them, not assumed.

The section above is the full record of the reasoning trail
(brute-force search, mirror-partner discovery, the corrected
`facesCongruent`) — this doc, not `docs/build-plan.md`, is the
authoritative record for the Catalan solids family, matching how batch
1 was documented too.

## Batch 3 done (2026-09-09): the 2 chiral solids — all 13 complete

Pentagonal icositetrahedron (dual of snub cube) and pentagonal
hexecontahedron (dual of snub dodecahedron) — irregular pentagon
faces (3 short sides + 2 long sides, single edge-length signature
confirmed per shape), genuinely chiral. Same polar-reciprocation
construction and vertex-0 canonicalization as batches 1-2; the
midsphere check held for both snub Archimedean bases too (differences
under 1e-11, verified directly rather than assumed despite their
coordinates coming from a numerically-solved chiral root, which made
this check matter more than usual, not less).

**The real open question going in**: does the `facesCongruent`
reversed-matching fix (found and fixed on `DISDYAKIS_TRIACONTAHEDRON`'s
chiral scalene triangles in batch 2) correctly generalize to these
chiral pentagons too, without any further changes? Confirmed, not
assumed: the complete `verify:face-attach` suite passed at 0 failures
across the full, final 137-shape registry on the first attempt with
both shapes included — no additional fix was needed. Makes sense in
hindsight (the fix addresses the general relationship between any
chiral 2D face and the normal-opposing attach transform, nothing
specific to triangles), but generalizing an argument correctly still
needed checking, not assuming, per this whole project's own
discipline.

**All 13 Catalan solids are now in this registry.** Nothing outstanding
for this family.
