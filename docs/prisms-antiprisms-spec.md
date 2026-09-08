# Prisms & Antiprisms — Scoping

Zalgaller proved in 1969 that 5 Platonic + 13 Archimedean + the
infinite prism/antiprism families + 92 Johnson solids is the complete,
closed classification of convex polyhedra with regular polygonal
faces (already cited in `docs/catalan-solids-spec.md`). Three of those
four pieces are in this registry. The fourth — prisms and antiprisms —
never got standalone entries: they appear constantly as internal
construction detail inside Johnson-solid builds (the "elongated"/
"gyroelongated" prefixes literally mean "with a prism/antiprism
inserted"), but no `PRISM_n`/`ANTIPRISM_n` shape has ever been added
to `POLYHEDRA` in its own right. This isn't a gap in Zalgaller's
classification — it's a gap in this registry's coverage of it.

Confirmed directly (not assumed) before writing this doc: grepping
`app/lib/polyhedra/*.ts` for any top-level `PRISM`/`ANTIPRISM` export
found none — every mention is inside a Johnson-solid doc comment
describing a construction step, never a registered shape.

Prisms/antiprisms are also why Johnson's own 1966 paper defines the 92
as regular-faced convex polyhedra "excluding the Platonic solids,
Archimedean solids, prisms, and antiprisms" — they're their own
already-classified uniform (vertex-transitive) family, deliberately not
folded into the 92, the same way this project doesn't re-add
`TRIANGULAR_GYROBICUPOLA` because it's already `CUBOCTAHEDRON`.

## The family, and why it needs a cutoff

Unlike Catalan solids (a closed set of exactly 13) or Johnson solids (a
closed set of exactly 92), prisms and antiprisms are a genuinely
**infinite** family — one of each for every n ≥ 3. There's no
mathematical stopping point to discover the way Catalan solids had one
in the golden-ratio structure of the icosahedral duals; this needs a
scope decision, not a derivation.

Checked computationally rather than assumed: does the antiprism height
formula already trusted in this registry (`h² = 1 - 2·R_n²·(1 - cos(π/n))`,
from `johnson.ts`'s batch-2 gyroelongation work, itself a law-of-cosines
derivation) stay valid — real, positive — as n grows, or does it hit a
natural ceiling the way, say, only 5 Platonic solids exist?

| n | R_n (unit-edge circumradius) | antiprism h² |
|---|---|---|
| 3 | 0.5774 | 0.6667 |
| 4 | 0.7071 | 0.7071 |
| 5 | 0.8507 | 0.7236 |
| 6 | 1.0000 | 0.7321 |
| 8 | 1.3066 | 0.7401 |
| 10 | 1.6180 | 0.7437 |
| 12 | 1.9319 | 0.7457 |
| 16 | 2.5629 | 0.7476 |

Stays positive and real for every n checked (3 through 16), converging
toward ≈0.75 rather than approaching zero — confirming there's no
natural mathematical cutoff at all; uniform antiprisms exist for every
n, all the way up. The cutoff genuinely has to be a scope choice.

**Recommendation**: cap at n = 10, matching the largest regular polygon
face already anywhere in this registry (the decagon, from
`TRUNCATED_DODECAHEDRON`/`TRUNCATED_ICOSIDODECAHEDRON` and the
pentagonal cupola/rotunda's decagonal base) — so prisms/antiprisms
don't introduce a new largest-face size inconsistent with everything
else already built. That gives:
- **Prisms**: n = 3, 5, 6, 7, 8, 9, 10 (7 shapes — n=4 skipped, see
  below)
- **Antiprisms**: n = 4, 5, 6, 7, 8, 9, 10 (7 shapes — n=3 skipped)

14 shapes total. Open to a different cutoff (8? 12?) — this is a
genuine scope call, not something to empirically test further, since
the math itself places no constraint.

## Two dedupes, same standard as every prior family

- **PRISM_4 = CUBE**, already `Platonic`. A square prism with
  square-not-rectangular lateral faces (the only uniform case) is
  exactly a cube. Skip, don't re-add.
- **ANTIPRISM_3 = OCTAHEDRON**, already registered (D8). A triangular
  antiprism is exactly a regular octahedron — this exact fact is
  already noted in `johnson.ts`'s own batch-2 comments ("n=3 would need
  a triangular antiprism, which is just an octahedron"). Skip.

Both confirmed by the same reasoning already applied to
`TRIANGULAR_GYROBICUPOLA`=`CUBOCTAHEDRON` and `J51`=`D14`: a
construction "working" isn't grounds to add it if it's provably
identical to something already in the registry.

## Construction method — reuses existing, already-verified formulas

No new derivation needed; both formulas are already load-bearing
elsewhere in this codebase:
- **Prism**: two regular n-gons, radius `R_n = 1/(2·sin(π/n))`, stacked
  directly above each other (no twist) at height 1 (unit edge, so the
  lateral square faces are actually square). Trivial — this is exactly
  what a cube already is for n=4.
- **Antiprism**: two regular n-gons twisted by π/n relative to each
  other, height `h` from the table above. Already the exact formula
  `johnson.ts` uses to gyroelongate cupolas/rotundas (batch 2) — this
  scoping doc's table just confirms it stays valid past the n=3,4,5
  range that context needed.

Both are simple enough to skip the scipy-ConvexHull-then-transcribe
pipeline used for every other family so far and generate coordinates
directly with the closed-form formulas above — low transcription risk,
similar to Archimedean batch 1's simple-integer solids. Still worth a
`validateShape()` pass (Euler's formula + uniform edge length) per
shape before trusting it, same as everywhere else.

## Normalization — no new mode needed

Unlike Catalan solids, every face here is a regular polygon (n-gon top/
bottom, square or triangle sides) at uniform edge length — `makeSpec`'s
existing "normalize to one uniform unit edge" convention applies
unchanged. No `makeSpecByCircumradius` needed.

## Face-attach — no new generalization needed either

`facesCongruent`/`faceRotationalSymmetry` (built for Catalan solids)
already handle regular n-gons correctly as their reduction case (that
was the whole point of checking them against all ~140 existing regular
faces before trusting either as a generalization). A prism's or
antiprism's square/triangle lateral faces and n-gon caps are all
regular, so no new face-attach code is needed — this batch is a pure
data addition on top of infrastructure that already exists, unlike
Catalan solids which needed the infrastructure built first.

One thing genuinely worth double-checking during implementation, not
assumed from the above: that a prism/antiprism's own square or
triangle lateral faces correctly offer face-attach compatibility
against the *existing* square/triangle faces already in the registry
(e.g. a prism's lateral square should be a valid face-attach target for
a cube's face, and vice versa) — should fall out automatically from
`facesCongruent`'s edge+angle check, but confirm via
`verify:face-attach`/`verify:face-twist` rather than assume.

## Wheel / UI placement

Recommend a new "Prisms & Antiprisms" family group in
`PolyhedralWheel.tsx`'s `FAMILIES` array, parallel to Platonic/
Archimedean/Johnson/Catalan — not folded into an existing group, since
it's a genuinely distinct classification (uniform, not
Platonic/Archimedean/Johnson/Catalan-transitive in the same senses).
This is unrelated to, and doesn't block or get blocked by, the
already-flagged "dual family-list classification" gap (letting D6/D10/
etc. also appear under Johnson) — a shape can already live under
multiple family groups without duplicating geometry, so both can be
done independently whenever convenient.

## Proposed order

Lowest risk first, same principle as every prior family: prisms before
antiprisms (no twist to get right, height is trivially 1), ascending n
within each. Confirm the whole 14-shape batch against
`verify:face-attach`/`verify:face-twist` before considering it done,
same bar as every other family — not just `validateShape()`, per the
batch-8 Johnson-solids lesson that edge-length uniformity alone doesn't
catch every geometry bug.
