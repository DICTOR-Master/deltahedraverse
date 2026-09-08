# Remaining Johnson Solids — Alternative Construction Protocols

Originally 21 of the 92 Johnson solids weren't in the registry: J64,
J66–J71, J79 (8 shapes with a specific, documented failure each — see
`docs/build-plan.md`'s batch 7-9 postmortems), and ~15 with no
closed-form construction attempted at all yet. Confirmed via web
research (not this project's own derivation) before writing this doc:
all 21 are long-published, fully classified shapes — nothing here is
an open mathematical question, only a gap in this registry's own
construction pipeline (see the "calculations failing, not the
scientific community" discussion this doc follows on from). Ordered
simplest-first, per direct user request: tackle the ones with the most
concretely diagnosed root cause first, since fixes there may carry
lessons (verification discipline, registration-checking habits) that
make the harder groups easier too, rather than the reverse.

**Status (2026-09-09): Groups 1-3 are all done (8 shapes: J64, J66-J71,
J79) — see below. Exactly 8 remain (92 - 79, not the "~13-15"
estimated earlier — corrected below), all Group 4: J85-J92. The
tooling needed was also overstated originally — see Group 4's own
corrected section: 6 of the 8 have a published polynomial root
`numpy.roots()` already handles (confirmed, not assumed); the other 2
are pure golden-ratio closed forms needing no root-finding at all.**

## Group 1 (simplest — single root cause already diagnosed): J66–J71

**What went wrong, per this project's own batch-8 postmortem**: these
were built with the identical method that correctly produced J65
(cupola capped onto a truncated solid's larger face), but some of the
merged quad faces (a cupola lateral triangle exactly coplanar with an
adjacent pre-existing truncated-solid triangle) turned out to be
rhombi, not true squares — passed Euler's-formula and uniform-edge
checks, failed the stricter cross-shape `verify:face-attach` tolerance.

**New finding this doc adds**: web research on J66 (augmented truncated
cube) specifies the cupola must be attached "such that the cupola's
square faces are adjacent [to] the triangular faces of the truncated
cube" — i.e. one SPECIFIC discrete rotational registration of the two
available for an octagon-capping cupola, not an arbitrary or default
one.¹ This is exactly the kind of detail a coplanar-merge bug would
produce if missed: the wrong registration puts the cupola's squares
next to the truncated solid's *squares* instead of its *triangles*,
which is precisely the configuration that would make an adjacent
triangle-pair merge into a rhombus instead of resolving cleanly.

**Recommended protocol, different from the batch-8 attempt in two
ways**:
1. Before generating a convex hull, explicitly check both possible cap
   registrations against the target truncated solid's actual adjacent
   face pattern (which of the base octagon's neighboring faces are
   triangles vs. squares) and pick the one matching the published
   description, rather than defaulting to "no extra twist."
2. Don't trust `scipy.spatial.ConvexHull`'s automatic coplanar face
   merging at all. After building the hull, explicitly check every
   merged face's diagonals/interior angles (the batch-8 lesson,
   already load-bearing everywhere else in this registry) — if a
   "merge" isn't a true square, that's a signal the registration or
   apex height is still wrong, not something to accept and move past.

Likely a single fix that unlocks all 6 shapes at once (same
construction method, same registration-detail root cause), which is
why this group is ranked simplest despite being 6 shapes, not 1.

**Confirmed and fixed (2026-09-09, batch 10): all 6 -- J66, J67, J68,
J69, J70, J71.** The hypothesis above was verified directly, not just
applied: every possible registration was built and diagonal-checked
for each affected face (8 for an octagon, 10 for a decagon), and the
results split cleanly in half every time — exactly the odd-offset
registrations produce a true, clean result (matching published face
composition exactly, zero non-square quads); the even offsets
(including batch 8's default) exactly reproduce the original
rhombus-contamination bug. J67 (biaugmented, opposite octagon pair —
confirmed externally, not assumed to be adjacent) needed each of its
two caps' registrations verified independently before combining, since
two different faces of the same solid could in principle need
different-parity registrations (the same hazard class as the
Catalan-solids face-vertex-0 bug) — there they happened to match. J69/
J70 used the truncated dodecahedron's decagon pairs, confirmed to
carry the SAME adjacent/meta/para classification already established
for the plain dodecahedron in batch 7/9 (not assumed to transfer) —
"para" (opposite) for J69, "meta" for J70, and J70 was directly
confirmed NOT congruent to J69 via the batch-3 pairwise-distance-
histogram check despite identical V/E/F. **J71 is where the
hypothesized different-parity hazard actually happened, not just in
theory**: its 3 target faces did NOT all need the same registration
parity (1 odd, 2 even) — confirmed only because each was checked fully
independently rather than assuming J67's "they happened to match"
result would generalize. See `docs/build-plan.md`'s batch 10 section
for the full record, including exact vertex/edge/face counts for each.

## Group 2 (single shape, root cause now understood): J64

**What went wrong**: batch 7 tried augmenting one of J63's PENTAGON
faces with a pentagonal pyramid — reasoning that "augmented
tridiminished icosahedron" meant re-augmenting a diminished vertex.
That construction is provably forced back to J62 (a regular pentagon's
matching pyramid apex position has no freedom), confirmed via a
rotation-invariant congruence check, not assumed.

**New finding this doc adds, and it's a real correction, not a
refinement**: J64 is NOT built by capping a pentagon. Per Wikipedia and
MathWorld, it's built by attaching a REGULAR TETRAHEDRON to a specific
TRIANGULAR face of J63 — "the triangular face adjacent to all three
[pentagons]" (MathWorld's own wording says "hexagons," almost
certainly a copy-paste error on their part since neither J63 nor J64
has any hexagonal face at all; read as "pentagons," the only faces
tridiminishing produces).²'³ Batch 7's attempt used the wrong face type
*and* the wrong cap entirely — not a subtly wrong version of the right
idea.

**Recommended protocol**: identify which of J63's 5 triangular faces
(already in this registry, verified) is adjacent to all 3 of its
pentagon faces — checkable directly and combinatorially from this
registry's own face/edge data, no external trust needed for that part
— then attach a regular tetrahedron to it (unit edge, same
closed-form apex-height math as every other pyramid cap in this
registry, `R_3^2 + h^2 = 1`). Verify the result is NOT congruent to
J62 via the same pairwise-distance-histogram check that caught the
original mistake, as a direct confirmation this really is a different
shape this time.

**Confirmed and fixed (2026-09-09, batch 10).** J63's 5 triangles
checked combinatorially against all 3 pentagons for a shared edge:
exactly one, `[0,1,5]`, is adjacent to all 3 — confirming MathWorld's
description precisely (and settling the "hexagons" wording as a
copy-paste error, not a hint at some other face). Attaching `D4` (the
tetrahedron, already in this registry) via the same face-attach
transform machinery as every cupola batch produced a clean result
immediately — no coplanar-merge ambiguity the way J66-J71 had, since a
tetrahedron's other 2 faces don't land flush against anything.
Directly confirmed NOT congruent to J62 (max pairwise-distance-
histogram diff 0.618). V=10, E=18, F=10 (7 triangles + 3 pentagons),
matching the externally published composition exactly.

## Group 3 (single shape, root cause NOT yet found — the bug's origin, not the construction choice): J79

**What went wrong**: batch 9's attempt gyrated a "para" (non-adjacent,
per this registry's own dodecahedron face-angle classification) pair
of regions, then tried diminishing a third region — all 10 possible
third-region choices failed with an IDENTICAL error magnitude
(max=3.05). That uniformity across all 10 candidates was already the
tell that this isn't about which region to pick.

**Original finding this doc added**: web research described the
correct construction as "two non-adjacent cupolae gyrated, a third
(non-adjacent to both) removed."⁴ At the time this was read as
confirming batch 9's own "para pair" choice (para = maximally
non-adjacent, 180°), so the hypothesis was that the construction plan
was already right and the bug was purely in execution.

**That reading was itself the bug — corrected 2026-09-09.** The
source's exact wording is "two further NON-OPPOSITE caps" — para
specifically means *opposite* (180°), so batch 9's premise was wrong
from the start, not just its execution. Confirmed decisively, not
just re-read more carefully: rebuilding the gyrate/diminish machinery
from scratch and checking combinatorially, EVERY ONE of the remaining
10 regions' waist rings shares 2 vertices with the para pair's own
pentagon caps — a structural consequence of RD's vertex configuration
(every vertex belongs to exactly one pentagon, so the para pair
between them already touches every other region). That's exactly why
all 10 candidates failed identically: not a coincidence needing
transform-tracing, but a real geometric impossibility baked into the
wrong premise. With the correct pair (RD's "meta" class, 116.6°) two
of the remaining 10 regions have zero waist overlap with either
gyrated cap — diminishing either produces a clean, valid J79.

**Fixed (2026-09-09, batch 11).** Rebuilt gyrate/diminish from scratch
(the original derivation script wasn't kept) and self-checked each
operation independently before combining: single gyrate exactly
reproduced J72 (0.000000 unordered point-set error), double gyrate
exactly reproduced J73 (5e-13), single diminish exactly reproduced J76
(confirmed via rotation-invariant histogram, since J76's stored
orientation differs from RD's own — an arbitrary choice, not a bug).
V=55, E=105, F=52 (15 triangles + 25 squares + 11 pentagons + 1
decagon), zero non-square quads, confirmed not congruent to J76/J77/
J78 via the same histogram check.

## Group 4 (hardest, tackle last): exactly 8 shapes, J85-J92

**Correction (2026-09-09), computed directly from the live registry,
not estimated**: this doc's earlier "~15" figure was wrong. With
Groups 1-3 all fixed (78 + J79 = 79/92), the actual gap is `J85`
through `J92` — the 8 "elementary" Johnson solids (J84, snub
disphenoid, is already covered as `D12`). Confirmed by diffing every
J-number 1-92 against this registry's own `JOHNSON_ADDITION_IDS` plus
the 5 deltahedra-covered numbers, not by re-counting an old estimate.

**Also corrected: the tooling requirement itself was overstated.**
Checked each of the 8 directly (Wikipedia, not guessed) rather than
assuming they're all in the same boat:

| Shape | What's actually needed |
|---|---|
| J85 (snub square antiprism) | root of a stated CUBIC polynomial (coefficients involve √2, √3) |
| J86 (sphenocorona) | root of a stated QUARTIC polynomial (an exact nested-radical form is also published) |
| J87 (augmented sphenocorona) | J86 + a square pyramid cap — the exact same closed-form pyramid-height technique already used since batch 1; no new root-finding beyond J86's own |
| J88 (sphenomegacorona) | root of a stated DEGREE-16 polynomial |
| J89 (hebesphenomegacorona) | the SECOND smallest positive root of a stated degree-10 polynomial — root selection matters, not just root-finding |
| J90 (disphenocingulum) | the SECOND smallest positive root of a stated degree-12 polynomial — same root-selection caveat as J89 |
| J91 (bilunabirotunda) | pure golden-ratio (√5-based) closed form — **no root-finding needed at all** |
| J92 (triangular hebesphenorotunda) | pure golden-ratio (τ-based) closed form — **no root-finding needed at all** |

None of these need a general nonlinear geometric constraint solver
(the "drive every-face-planar-and-unit-edge toward zero residual"
approach this doc originally proposed). Every one of the 8 already has
a *published, closed-form* defining equation — the actual gap is much
narrower: **numerically extracting the correct real root of an
already-known polynomial**, not discovering an unknown shape from
scratch.

**Tooling requirement, defined precisely**: `numpy.roots()` — finds
all roots (real and complex) of a polynomial from its coefficient
list via a companion-matrix eigenvalue decomposition, degree
unbounded in practice. **Already available, nothing to install**: this
project's `python3` environment already has `numpy` (confirmed
2.5.0) and `scipy` (1.18.0) installed and in active use throughout
this whole registry's derivation pipeline. Verified directly, not
assumed: ran J85's actual published cubic
(`9x³+3√3(5−√2)x²−3(5−2√2)x−17√3+7√6`) through `numpy.roots()` and got
`0.8235388277869001`, matching the published `k ≈ 0.82354` to 5
decimal places; separately confirmed `numpy.roots` handles a
degree-16 polynomial without issue.

**Recommended protocol per shape**: (1) fetch the shape's exact,
complete published polynomial and coordinate formula (not just the
excerpt a search snippet returns — the full coefficient list, since a
single dropped term changes every root); (2) run it through
`numpy.roots()`, filter to real roots, and for J89/J90 specifically
select the SECOND smallest positive one, not the smallest — verify the
choice, don't assume "smallest" is always right, since a wrong root
would silently produce self-intersecting or non-convex geometry;
(3) build coordinates from the published formula using that root;
(4) run the exact same verification pipeline as every other shape in
this registry — `scipy.spatial.ConvexHull`, Euler's formula, unit-edge
check, and (given this family's typically low symmetry) the
quad/face-regularity diagonal check from the batch-8 lesson. This is a
genuine batch-12 candidate, not a separate infrastructure project.

## Sources consulted (external, cross-checked against this project's own verification harness before any construction is accepted — never trusted directly per this registry's established discipline)

1. [Augmented truncated cube — Wikipedia](https://en.wikipedia.org/wiki/Augmented_truncated_cube)
2. [Augmented Tridiminished Icosahedron — Wolfram MathWorld](https://mathworld.wolfram.com/AugmentedTridiminishedIcosahedron.html)
3. [Augmented tridiminished icosahedron — Wikipedia](https://en.wikipedia.org/wiki/Augmented_tridiminished_icosahedron)
4. [Bigyrate diminished rhombicosidodecahedron — Wikipedia](https://en.wikipedia.org/wiki/Bigyrate_diminished_rhombicosidodecahedron)
5. [Snub square antiprism — Wikipedia](https://en.wikipedia.org/wiki/Snub_square_antiprism)
6. [Sphenocorona — Wikipedia](https://en.wikipedia.org/wiki/Sphenocorona)
7. [Augmented sphenocorona — Wikipedia](https://en.wikipedia.org/wiki/Augmented_sphenocorona)
8. [Sphenomegacorona — Wikipedia](https://en.wikipedia.org/wiki/Sphenomegacorona)
9. [Hebesphenomegacorona — Wikipedia](https://en.wikipedia.org/wiki/Hebesphenomegacorona)
10. [Disphenocingulum — Wikipedia](https://en.wikipedia.org/wiki/Disphenocingulum)
11. [Bilunabirotunda — Wikipedia](https://en.wikipedia.org/wiki/Bilunabirotunda)
12. [Triangular hebesphenorotunda — Wikipedia](https://en.wikipedia.org/wiki/Triangular_hebesphenorotunda)
