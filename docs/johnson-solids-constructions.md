# Johnson Solids — Hard-Construction Directory

A reference for the Johnson solids in this registry whose construction
needed something beyond a single closed-form apex-height equation —
a discrete registration search, a combinatorial face-selection rule, a
multi-step operation composed from smaller pieces that were each
independently verified first, or (for the 8 "elementary" solids J85-
J92 that complete all 92) a published external polynomial or
golden-ratio closed form solved directly. Companion to
[`data/johnson-solids-hard-constructions.json`](../data/johnson-solids-hard-constructions.json)
(the same information as structured, machine-readable open data — see
that file's own `$schema_note`) and `docs/build-plan.md` (the full
narrative postmortems these are distilled from).

Every entry below was verified computationally against this registry's
own `POLYHEDRA` data before being recorded — see each entry's
**Verification** line — not transcribed from memory or trusted from an
external source without cross-checking.

| Shape | Base(s) | Operation | Key parameter | Result (V, E, F) |
|---|---|---|---|---|
| [J64](#j64) | J63 + D4 | face-attach | target face found combinatorially | 10, 18, 10 |
| [J66](#j66) | Truncated cube + J4 | face-attach | registration k=1 of 8 | 28, 48, 22 |
| [J67](#j67) | Truncated cube + J4×2 | face-attach ×2 | opposite face pair | 32, 60, 30 |
| [J68](#j68) | Truncated dodecahedron + J5 | face-attach | registration k=1 of 10 | 65, 105, 42 |
| [J69](#j69) | Truncated dodecahedron + J5×2 | face-attach ×2 | "para" face pair | 70, 120, 52 |
| [J70](#j70) | Truncated dodecahedron + J5×2 | face-attach ×2 | "meta" face pair | 70, 120, 52 |
| [J71](#j71) | Truncated dodecahedron + J5×3 | face-attach ×3 | mutually-meta triple | 75, 135, 62 |
| [J79](#j79) | Rhombicosidodecahedron | gyrate×2 + diminish×1 | "meta" gyrate pair | 55, 105, 52 |
| [J85](#j85) | — | published cubic root | achiral (verified, not assumed) | 16, 40, 26 |
| [J86](#j86) | — | published quartic root | — | 10, 22, 14 |
| [J87](#j87) | J86 + J1 | face-attach | square pyramid cap | 11, 26, 17 |
| [J88](#j88) | — | published degree-16 root | — | 12, 28, 18 |
| [J89](#j89) | — | published degree-10 root | SECOND smallest positive root | 14, 33, 21 |
| [J90](#j90) | — | published degree-12 root | SECOND smallest root + D2d group (S4 needed, not just reflections) | 16, 38, 24 |
| [J91](#j91) | — | golden-ratio closed form | no root-finding | 14, 26, 14 |
| [J92](#j92) | — | golden-ratio closed form | no root-finding | 18, 36, 20 |

## J64 — augmented tridiminished icosahedron

**Base**: `J63_TRIDIMINISHED_ICOSAHEDRON` + `D4` (regular tetrahedron).
**Target face**: the *one* triangular face of J63 that is edge-adjacent
to all 3 of its pentagons — found by checking each of J63's 5
triangles against all 3 pentagons for a shared edge; exactly one
(vertices `[0,1,5]` in this registry's own J63 indexing) qualifies.
**Cap registration**: trivial — a triangle's 3-fold symmetry makes all
3 discrete registrations equivalent.

**A real wrong turn worth recording**: an earlier attempt augmented a
*pentagon* face with a pentagonal pyramid instead — this is provably
forced back onto `J62_METABIDIMINISHED_ICOSAHEDRON` (a regular
pentagon's matching pyramid apex position has no freedom), confirmed
via a rotation-invariant congruence check. J64 needed an entirely
different operation, not a corrected version of that one.

**Verification**: Euler's formula, unit edge length, outward face
winding, and a direct congruence check confirming the result is NOT
J62 (pairwise-distance-histogram max diff 0.618).

## J66 — augmented truncated cube

**Base**: `TRUNCATED_CUBE` + `J4_SQUARE_CUPOLA`.
**Target face**: any one of the 6 octagons (symmetric).
**Cap registration**: an octagon has 8 discrete registrations; exactly
the **odd** offsets (1, 3, 5, 7) produce a valid result — the cupola's
own squares must land next to the truncated cube's *triangles*, not
its own larger faces. The even offsets reproduce a specific,
diagnosable failure: one pre-existing truncated-cube triangle becomes
exactly coplanar with an adjacent cupola triangle and merges into a
**rhombus** (unit edges, unequal diagonals √3 vs 1) instead of a true
square.

**Verification**: Euler's formula, unit edge length, outward winding,
and a quad-diagonal check (a true square has equal diagonals of √2).

## J67 — biaugmented truncated cube

**Base**: `TRUNCATED_CUBE` + `J4_SQUARE_CUPOLA` × 2.
**Target faces**: the **opposite** octagon pair (confirmed externally
before building — not assumed to be adjacent or opposite).
**Cap registration**: each of the 2 capped faces had its registration
verified *independently* (both turned out to need the same parity,
odd — checked, not assumed) before combining into the final shape.

## J68 — augmented truncated dodecahedron

**Base**: `TRUNCATED_DODECAHEDRON` + `J5_PENTAGONAL_CUPOLA`.
Same pattern as J66, generalized from octagon (8 registrations) to
decagon (10 registrations) — odd offsets clean, even offsets
reproduce the same rhombus-contamination failure mode.

## J69 — parabiaugmented truncated dodecahedron

**Base**: `TRUNCATED_DODECAHEDRON` + `J5_PENTAGONAL_CUPOLA` × 2.
**Target faces**: the **"para"** (opposite, `cos θ = -1`) decagon pair.
The truncated dodecahedron's 12 decagons carry the *same*
adjacent/meta/para face-angle classification already established for
the plain dodecahedron elsewhere in this registry (`cos θ ≈ 0.4472 /
-0.4472 / -1`) — confirmed, not assumed, since the 12 decagons
correspond 1:1 to the dodecahedron's 12 faces.

**Verification** includes a direct congruence check confirming J69 is
NOT congruent to J70 (pairwise-distance-histogram max diff 0.244)
despite both sharing identical V/E/F/face-composition.

## J70 — metabiaugmented truncated dodecahedron

Same as J69, but the **"meta"** (`cos θ ≈ -0.4472`) decagon pair
instead of "para."

## J71 — triaugmented truncated dodecahedron

**Base**: `TRUNCATED_DODECAHEDRON` + `J5_PENTAGONAL_CUPOLA` × 3.
**Target faces**: a **mutually-meta triple** of decagons (all 3
pairwise `cos θ ≈ -0.4472`) — 20 such triples exist by symmetry, any
one works.

**The one genuinely new finding in this whole directory**: the 3
target faces did **not** all need the same registration parity — 1
needed an odd offset, the other 2 needed even offsets. Every other
multi-cap shape in this directory (J67, J69, J70) happened to have all
its capped faces share the same parity; J71 is the confirmed instance
of the hazard those shapes' own construction notes had only
*hypothesized* — a face's registration parity depends on that
specific face's own vertex-0 phase, which has no reason to be
consistent across different faces of the same solid. Caught only
because each of the 3 faces was verified completely independently
rather than assuming J67's "they happened to match" result would
generalize.

## J79 — bigyrate diminished rhombicosidodecahedron

**Base**: `RHOMBICOSIDODECAHEDRON` alone (no separate cap piece — the
"gyrate" and "diminish" operations both act on RD's own already-present
geometry).

**Region decomposition**: RD splits into 12 local pentagonal-cupola-
shaped regions, one per pentagon face — each pentagon's 5 vertices
(the "cap") surrounded by a ring of 5 triangles alternating with 5
squares (the "waist," 10 vertices). Extracted combinatorially from RD's
own face/edge data. The 12 regions carry the same adjacent/meta/para
classification as the plain dodecahedron.

**Gyrate**: rotate a region's 5 cap vertices by exactly 36° (one
waist-ring step) around the axis through RD's center and the pentagon's
own centroid, keeping the waist fixed.

**Diminish**: remove a region's 5 cap vertices entirely, exposing its
waist ring as a real decagon face.

**Constraint that actually matters**: a diminished region's waist ring
must share **zero** vertices with any gyrated region's cap. Since every
RD vertex belongs to exactly one pentagon, a region "close enough" to a
gyrated one *will* share vertices with it, and diminishing it then
produces a badly distorted shape (observed: max edge length up to 3.05,
vs. the correct 1.0).

**A wrong turn made twice, worth recording carefully**: the natural
first guess is to gyrate RD's "para" (opposite) pair, since that
exactly reproduces `J73_PARABIGYRATE_RHOMBICOSIDODECAHEDRON`'s own
already-verified construction. This is wrong for J79 specifically — an
external source describing J79 says the two gyrated caps are
"non-opposite," which the para pair does not satisfy. This exact
misreading happened **twice independently**: once in this registry's
original attempt, and once again when an earlier scoping pass read the
same source and concluded (incorrectly) that the original attempt's
premise was already correct, with the bug hiding somewhere in
execution instead. It wasn't — checked combinatorially, the para pair's
2 caps between them touch *every one* of the other 10 regions' waist
rings, which is exactly why every possible third-region choice failed
identically. With the correct **"meta"** gyrate pair, exactly 2 of the
remaining 10 regions have zero waist overlap and diminish cleanly.

**Self-check discipline before trusting the final result**: the
gyrate/diminish machinery was rebuilt from scratch (the original
derivation script wasn't kept, per this project's convention of
deriving offline and transcribing only the final result) and validated
against shapes already in the registry *before* being trusted for
J79 itself — single gyrate exactly reproduces `J72`, double gyrate
exactly reproduces `J73`, single diminish exactly reproduces `J76`
(via a rotation-invariant congruence check, since J76's own stored
orientation turned out to differ arbitrarily from RD's).

## The 8 "elementary" Johnson solids (J85–J92)

Genuinely different in kind from every shape above: none of these
reduce to an operation on an already-registered piece. Each is defined
in the literature by its own published polynomial (or, for 2 of them,
a pure golden-ratio closed form), with a small set of generator points
expanded by a stated symmetry group. No general nonlinear geometric
solver was needed anywhere here — `numpy.roots()` on each shape's own
published polynomial, already available in this project's existing
Python environment, was sufficient every time.

## J85 — snub square antiprism

**Defining polynomial**: cubic,
`9x³+3√3(5−√2)x²−3(5−2√2)x−17√3+7√6`, positive root ≈0.82354.
**Symmetry group**: order 16, generated by a 90° rotation about z and
a 180° rotation about a perpendicular axis at 22.5° to x — both
*proper* rotations.

**A real finding, checked rather than assumed from the name**: despite
"snub" suggesting the chiral snub-solid family already in this
registry (`SNUB_CUBE`, `SNUB_DODECAHEDRON`, J44-J48), J85 is
**achiral**. A genuine point-for-point rotation was found mapping its
mirror image exactly back onto the original vertex set.

## J86 — sphenocorona

**Defining polynomial**: quartic, `60x⁴−48x³−100x²+56x+23`, smallest
positive root ≈0.85273 (an exact nested-radical form is also
published: `k=(6+√6+2√(213−57√6))/30`).
**Symmetry group**: order 4 (reflections about the xz- and yz-planes).

## J87 — augmented sphenocorona

**Base**: `J86_SPHENOCORONA` + `J1_SQUARE_PYRAMID`, on either of J86's
2 square faces (equivalent by symmetry). No new polynomial — a plain
face-attach using J86's own quartic root.

## J88 — sphenomegacorona

**Defining polynomial**: degree 16 — not practically expressible in
radicals, `numpy.roots()` used directly (confirmed working on this
exact polynomial before trusting it: matched the published `k≈0.59463`
to 7 significant figures). **Symmetry group**: order 4 (same
reflection pair as J86).

## J89 — hebesphenomegacorona

**Defining polynomial**: degree 10. **Root selection matters here**:
the constant is the **second smallest** positive root (≈0.21684), not
the first — verified by checking which choice actually yields all-unit
edges, not by trusting "second smallest" blindly.
**Symmetry group**: order 4.

## J90 — disphenocingulum

**Defining polynomial**: degree 12, second smallest positive root
(≈0.76713), same root-selection caveat as J89.

**The most subtle finding in this whole directory**: the Wikipedia
source's own prose states its 3 generator points are expanded by
"reflections about the xz-plane and the yz-plane" alone — but two
perpendicular mirror planes only ever generate an order-4 group,
which cannot reach the article's own stated 16 vertices from 3 points
(maximum possible: 3×4=12). This was caught by checking actual edge
lengths, not by trusting the source: the naive reading produced
several vertex pairs 0.65-0.93 units apart instead of exactly 1. The
correct group is the full **D2d (order 8)**, requiring an S4
rotoreflection generator the prose never mentioned — confirmed by
matching the same article's own `vertex_config` field (multiplicities
4/4/8) and by computing the group closure explicitly, then verifying
exact unit edges.

## J91 — bilunabirotunda

**Pure golden-ratio closed form, no root-finding at all**:
`(0,0,±1)`, `(±(√5−1)/2, ±1, ±(√5−1)/2)`,
`(±(√5+1)/2, ±(√5−1)/2, 0)`, all sign combinations, edge length
`√5−1`.

## J92 — triangular hebesphenorotunda

**Pure golden-ratio (τ) closed form, no root-finding at all**: 4
generator points expanded by a dihedral group of order 6 (120°
rotation about z, reflection about the yz-plane).
