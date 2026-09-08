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

**Status (2026-09-09): Group 1 (all 6 of J66-J71) and Group 2 (J64) are
both done — see below. 14 remain (92 - 78): J79 (1) and ~13 with no
closed form at all.**

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

**New finding this doc adds**: web research confirms the correct
construction is exactly what was attempted — two non-adjacent cupolae
gyrated, a third (non-adjacent to both) removed.⁴ That means Group 3's
failure is NOT a wrong combinatorial choice (unlike Group 1 and Group
2, where research revealed the attempted construction was simply
wrong) — the construction plan was already right, so the bug is
somewhere in its execution.

**Recommended protocol, different in kind from Groups 1-2**: this
needs the same "trace the actual transform, don't guess" discipline
that found the real Catalan-solids self-attach bug (vertex-0 role
inconsistency) after two wrong hypotheses were ruled out. Specifically:
print the vertex positions after the first gyration, after the second
gyration, and going into the diminish step, and check each stage
independently against what a single-gyration diminished
rhombicosidodecahedron (already correctly built, J77/J78) would
produce for the same region — the identical-error-across-all-10 result
strongly suggests the two gyrations aren't composing correctly (second
gyration applied in a frame that's already been rotated by the first,
or a shared-vertex bookkeeping error between the two regions), not
that a right answer is hiding among 10 wrong candidates.

## Group 4 (hardest, tackle last): ~15 with no closed-form construction

Genuinely different in kind from the other 3 groups: every batch built
so far (including the corrected Groups 1-2 above) solves for an
unknown single parameter (a pyramid's apex height, an antiprism's
insertion height) via one closed-form equation from the law of
cosines. Several of the remaining ~15 Johnson solids don't reduce to
a single-equation closed form at all — their defining constraint
(every face planar, every edge unit length, specific dihedral angles)
is a genuinely coupled system, solved in the literature numerically
rather than algebraically.

**Recommended protocol**: this needs a capability this registry
doesn't have yet, not just another application of what already
exists — a general numerical constraint solver (e.g. Newton's method
or nonlinear least-squares over a parameter vector, driving "every
face planar and every edge unit length" toward zero residual from a
reasonable initial guess) rather than one-off closed-form derivations.
Worth scoping as its own follow-up once Groups 1-3 are done, not
attempted piecemeal per-shape the way every batch so far has worked.
Cross-referencing published coordinates (same "verify externally
sourced starting data through this project's own independent harness,
never trust blindly" discipline used throughout this registry — see
the snub cube chiral-constant mistranscription bug this same approach
already caught once) is the fastest path in here, using numerical
solving only to confirm/refine rather than derive from nothing.

## Sources consulted (external, cross-checked against this project's own verification harness before any construction is accepted — never trusted directly per this registry's established discipline)

1. [Augmented truncated cube — Wikipedia](https://en.wikipedia.org/wiki/Augmented_truncated_cube)
2. [Augmented Tridiminished Icosahedron — Wolfram MathWorld](https://mathworld.wolfram.com/AugmentedTridiminishedIcosahedron.html)
3. [Augmented tridiminished icosahedron — Wikipedia](https://en.wikipedia.org/wiki/Augmented_tridiminished_icosahedron)
4. [Bigyrate diminished rhombicosidodecahedron — Wikipedia](https://en.wikipedia.org/wiki/Bigyrate_diminished_rhombicosidodecahedron)
