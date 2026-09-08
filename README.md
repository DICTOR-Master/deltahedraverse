# Polyhedraverse

<p align="center">
  <img src="public/brand/logo.png" alt="Polyhedraverse" width="280">
</p>

**Open-source spatial geometry environment**

### Spatial Editing Suite
*Construct • Transform • Connect • Explore*

> An open-source spatial geometry environment for constructing,
> transforming, and interconnecting polyhedral forms in three dimensions.

A browser-based construction kit for convex polyhedra. Two ways to
connect pieces: click a free vertex and snap on a new piece with a free
rotational joint (molecular-model-kit style — started with the 8 convex
deltahedra specifically because they don't tile space and their dihedral
angles are incompatible across types), or click a free face and glue on
a shape with a matching face size for a real shared-face join (a cube
onto a cube, say), with a discrete rotational registration instead of a
free twist. A view toggle (Solid / Translucent / Inside view) lets you
see through a structure once pieces start nesting.

The intention is for this to grow into a sibling of
[Rhombiverse](https://github.com/DICTOR-Master/rhombiverse) — a general
polyhedral space-editing suite covering the Platonic and Archimedean
solids and the Johnson solid family alongside the 8 deltahedra, with its
own introductory geometric-packing puzzle game in the spirit of
Rhombiverse's RHOMBIS (working name: DELTIS). See `docs/build-plan.md`'s
trailing sections for what's actually shipped versus what's still ahead.

## Scope

- Platonic solids
- Archimedean solids
- Johnson solids
- Catalan solids
- Prisms & antiprisms
- Geometric transformations
- Spatial placement and orientation
- Lattice construction
- Interpenetrating structures
- Polyhedral relationships
- Concave (non-convex) polyhedra — may be added later, alongside the
  convex families above
- (room to grow) more unusual spatial operations as they're developed

This list is intentionally open-ended, describing the project's
direction rather than a feature checklist — so the README doesn't need
rewriting every time a new capability lands. **"What's here now" below
is the ground truth for what's actually shipped today**; Johnson solids
are in progress (79 of 92 so far), Catalan solids just started (2 of 13
so far), and lattice construction / interpenetrating structures are
still direction, not yet delivered.

## What's here now

The original 8-stage build plan (all 8 deltahedra, pick/attach/twist/
confirm, a real persisted assembly graph, the D10↔D12 rewrite rule,
cascade delete) is done — see `docs/build-plan.md` for the full
stage-by-stage account, including exactly how each stage was verified.
Since then:

- **Geometry core, restructured for multiple families**
  (`app/lib/polyhedra/`) — `core.ts` holds family-agnostic infrastructure
  (vertices+edges+faces as the only source of truth; everything else
  derived), with one file per family. D12 (snub disphenoid) is the one
  deltahedron with no compass-and-straightedge construction — its
  coordinates come from the positive real root of an irreducible cubic,
  hardcoded rather than solved at runtime.
- **Platonic solids added** — cube and dodecahedron (tetrahedron,
  octahedron, and icosahedron were already deltahedra D4/D8/D20).
  Cross-checked against a true 3D convex-hull computation, not
  hand-derived: an early attempt at the dodecahedron's face list, based
  on a plausible-looking heuristic, produced silently wrong, non-planar
  faces — see `docs/build-plan.md` for what that looked like and how it
  was actually fixed.
- **All 13 Archimedean solids** — cuboctahedron and the two truncated
  simple-integer solids first (low transcription risk), then the
  remaining 10 (golden-ratio coordinates, a truncated icosahedron derived
  by 1/3-edge-truncating this project's own icosahedron, and two chiral
  snub solids needing a numerically-solved root). Caught real
  transcription bugs building these, at more than one level — mismatched
  independently-generated vertex/edge orderings, a hand-guessed edge list,
  a mis-transcribed defining cubic for the snub cube's chiral constant
  (caught because it produced two different edge lengths instead of one),
  and a precision-rounding bug that broke a downstream verification
  script's tolerance without the shapes themselves being wrong — all
  worked examples in `docs/build-plan.md` of why every claim here gets a
  computational cross-check rather than trust.
- **79 of 92 Johnson solids so far**, in batches, each with a full
  postmortem in `docs/build-plan.md`. Batches 1-6 built the pyramids,
  cupolas, rotunda, and every elongated/gyroelongated/bicupola/
  augmented-prism form of them (34 shapes) — along the way, verifying
  rather than assuming the ortho/gyro twist angle (the triangular case
  coincides exactly with the already-registered cuboctahedron, the real
  reason "triangular gyrobicupola" isn't its own Johnson solid),
  catching a rounding-reused-as-computed-value precision bug, and
  confirming computationally (not guessed) that several gyroelongated
  shapes and both snub Archimedean solids are genuinely chiral — only
  one handedness of each is stored, which matters for face-attach (a
  mirror-image toggle is a real, not-yet-built gap this surfaced).
  Batch 7 added augmented dodecahedra and bidiminished/tridiminished
  icosahedra (6 shapes), deliberately excluding "augmented tridiminished
  icosahedron" (J64) once its natural construction was shown to be
  *provably* congruent to an already-registered shape. **Batch 8
  (augmented truncated Archimedean solids) is the most important
  methodological lesson in this registry so far**: 6 of 7 attempted
  shapes passed every check used through batch 7 (Euler's formula,
  uniform edge length) and were still wrong — some of their "extra"
  merged quad faces turned out to be rhombi (unit edges, unequal
  diagonals) rather than true squares, caught only by
  `verify:face-attach`/`verify:face-twist`'s stricter cross-shape
  tolerance. Only J65 survived; J66-J71 were reverted rather than
  shipped wrong. **Edge-length uniformity alone doesn't confirm a face
  is regular** — a rhombus and a square can have identical edges — and
  every batch since checks face diagonals explicitly, not just edges.
  Batch 9 (gyrate/diminished rhombicosidodecahedra, 11 of 12 attempted
  shapes) applied that discipline from the start and passed cleanly on
  the first attempt, on a much larger, more combinatorially complex
  family; only J79 (bigyrate diminished) was left out after failing
  identically across all 10 possible constructions. **Batch 10
  corrected all 6 of batch 8's excluded shapes (J66-J71)**: external
  research (`docs/johnson-solids-remaining-spec.md`) found the missing
  detail — the cupola cap needs one specific discrete registration
  (its squares next to the truncated solid's triangles), not the
  default "no extra twist" batch 8 used. Verified directly by sweeping
  every possible registration for the affected faces: exactly half
  reproduce a clean result, the other half exactly reproduce batch 8's
  rhombus-contamination bug, confirming the diagnosis rather than
  merely working around it. J71 (three cupolas on a mutually-meta
  decagon triple) surfaced a real, previously only hypothesized
  wrinkle: its 3 target faces did NOT all need the same registration
  parity, caught only because each was verified fully independently.
  **J64 also corrected in the same batch**: external research revealed
  batch 7's exclusion reasoning was based on the wrong operation
  entirely — the real construction attaches a regular tetrahedron to
  one specific TRIANGLE face of J63 (found combinatorially: the one
  triangle edge-adjacent to all 3 of its pentagons), not a pentagonal
  pyramid on a pentagon. Directly confirmed not congruent to J62 (the
  shape batch 7's wrong attempt collapsed into) via the same
  congruence check that first caught that mistake. **Batch 11 fixed
  J79 too**: batch 9's own attempt, and this doc's first reading of
  the external research describing it, both assumed the 2 gyrated
  regions were RD's "para" (opposite) pair — the source actually says
  "non-opposite." Checked combinatorially, the para pair touches every
  other region's waist ring (a structural consequence of RD's vertex
  configuration), explaining why all 10 diminish choices failed
  identically; with the correct "meta" pair, 2 of the 10 remaining
  regions diminish cleanly. Rebuilt the gyrate/diminish machinery from
  scratch and self-checked each operation against already-registered
  shapes (exact match to J72/J73/J76) before trusting it for J79
  itself. 5 of the 92 are already deltahedra in this registry (D6/D10/
  D12/D14/D16) and aren't re-derived. The remaining ~13 shapes have no
  closed form at all — the only group left, needing genuinely new
  numerical-solver tooling this registry doesn't have yet.
  First shape in this registry that isn't vertex-transitive: J1's apex
  has degree 4 while its base vertices have degree 3. First with no
  degree-3 vertex at all: J10 (only degree 4 and 5).
- **Catalan solids — 2 of 13 so far** (rhombic dodecahedron, rhombic
  triacontahedron), the first family with genuinely irregular faces
  (face-transitive, not vertex-transitive — congruent rhombi, not
  regular polygons). Needed two real generalizations, not just more
  registry entries: `makeSpecByCircumradius` (circumradius = 1
  per-shape normalization, chosen empirically over 3 rejected
  alternatives) and `facesCongruent`/`faceRotationalSymmetry` (real
  edge+angle congruence and a face's own rotational-symmetry order,
  replacing vertex-count-only matching that was only ever safe because
  every prior family had regular faces — this fix applies everywhere,
  not just to Catalan shapes). Building these two surfaced a subtle bug
  worth remembering for the remaining 11: a face's "vertex 0" needs a
  consistent geometric role (e.g. always the acute corner of a rhombus)
  before any index-based alignment can trust it — trivially true for a
  regular n-gon, not automatically true for an irregular one. See
  `docs/catalan-solids-spec.md` for the full design record.
- **Pick, attach, twist, confirm/cancel** — hover a vertex to see its
  capacity, pick a shape to attach, drag to twist it around the one
  remaining rotational degree of freedom, then confirm or cancel.
- **A real assembly graph** (`app/lib/assembly.ts`), built only from
  user actions and persisted through an API route
  (`app/api/assemblies/`) — reload restores exactly what you built.
- **The D10↔D12 rewrite rule** — swap a placed node's shape in place;
  existing connections re-anchor to the most directionally-similar
  vertex on the new shape where one exists, or get flagged rather than
  guessed.
- **Cascade delete**, a capacity glow so you can see at a glance which
  nodes still have room to build from, and a (currently unreachable,
  honestly documented) cycle-detection primitive for a future "closed
  cage" goal.
- **Face-to-face connections** — click a free face (not just a vertex)
  to glue on a shape with a matching face size. Two coincident regular
  n-gon faces have no free rotation the way a vertex ball-joint does —
  only *n* discrete registrations keep them flush — so dragging a
  pending face-attach cycles through those instead of spinning freely.
  Getting the placement math right took a real wrong turn worth reading
  about in `docs/build-plan.md`: assuming "no extra twist" or "a
  multiple of 360°/n from zero" is already correct turned out false for
  most shape pairs: the fix was computing the angle analytically instead
  of guessing.
- **A view toggle** (Solid / Translucent / Inside view) for seeing
  through a structure once pieces start nesting — applies to every
  placed shape at once.
- **PolyhedralWheel** — a dodecahedron-shaped 3D radial menu (`Tab` /
  `Space`, or the always-visible corner medallion, to open) replacing the
  flat shape-picker button row, which doesn't scale to 100+ shapes.
  Family-grouped (deltahedra/Platonic/Archimedean/Johnson), ported from
  Rhombiverse's Rhombic Wheel with its own green color identity rather
  than a straight reskin (a small silver corner medallion,
  `CornerHudWheel`, is the one piece that stays silver, matching
  Rhombiverse's own equivalent). Also filters to compatible shapes when
  picking a face-attach target. Actions (augment/diminish) and
  Spherical/X-Ray view modes are still deferred — see
  `docs/build-plan.md`'s own sections for the full design record.

## Structure

```
polyhedraverse/
  app/
    lib/
      polyhedra/
        core.ts          # family-agnostic infra: PolyhedronSpec, makeSpec, validateShape, triangulateFace, buildFaceConnectors
        deltahedra.ts    # the 8 deltahedra, verified against a convex hull
        platonic.ts      # cube + dodecahedron (the 2 Platonic solids not already deltahedra)
        archimedean.ts   # all 13 Archimedean solids
        johnson.ts       # 79 of 92 Johnson solids so far
        catalan.ts       # 2 of 13 Catalan solids so far (rhombic dodecahedron, rhombic triacontahedron)
        rewrite.ts       # D10<->D12 vertex-matching (pure function, no three.js)
        index.ts         # combined POLYHEDRA / POLYHEDRON_IDS across every family
      assembly.ts        # the real {nodes, connections} graph + validation (vertex- and face-kind)
      graph.ts           # subtree/cycle graph logic (pure, no three.js)
    components/
      ShapeViewer.tsx    # the whole Three.js scene: render, pick, attach/face-attach, twist, rewrite, delete, view modes
    api/assemblies/      # GET/POST persistence route (local JSON for now; see docs)
    page.tsx             # UI shell around ShapeViewer
  scripts/               # validate-*, verify-attach/twist/rewrite/graph/face-* -- run outside the browser
  tests/e2e/             # permanent Playwright suite (npm run test:e2e)
  data/
    johnson-solids-hard-constructions.json  # open, machine-readable construction recipes for the 8 non-closed-form Johnson solids
  docs/
    build-plan.md               # the build plan, with how each stage was verified
    construction-kit-spec.md    # the vertex-snapping design law + extensibility notes
    catalan-solids-spec.md      # scoping + design record for the Catalan solids family (2/13 done)
    prisms-antiprisms-spec.md   # scoping + design record for prisms/antiprisms (14/14 done)
    johnson-solids-remaining-spec.md  # alternative construction protocols for the remaining Johnson solids (Groups 1-3, 8 shapes, fixed)
    johnson-solids-constructions.md   # human-readable directory of those same 8 constructions, alongside data/johnson-solids-hard-constructions.json
    vercel-deployment-plan.md   # planned repo/Vercel layout once this deploys
  playwright.config.ts
```

## Design documents (`docs/`)

Read `docs/build-plan.md` first — the stage-by-stage build order, and,
for each stage, what was actually verified and how (geometry-math
scripts, direct API calls, and eventually a real-browser Playwright
pass) rather than assumed. `docs/construction-kit-spec.md` has the
underlying design law (vertex-snapping, not face-gluing; derive
connector data from vertices + edges, never hand-declare it
separately). `docs/catalan-solids-spec.md` scopes the Catalan solids — implementation
started (2 of 13 done) — including why they need genuinely new
infrastructure (non-uniform edge lengths, irregular-polygon face-attach
registration) rather than dropping into the existing "regular,
unit-edge" pipeline unchanged, and a real bug found while building the
first two (face-vertex-0 needing a consistent geometric role, not just
a consistent index). `docs/prisms-antiprisms-spec.md` scopes and records
the last piece of Zalgaller's classification that was missing from this
registry — prisms/antiprisms were used constantly as construction
detail inside Johnson-solid builds but never registered as their own
shapes; unlike Catalan solids this needed no new infrastructure, just a
scope decision (the family is genuinely infinite, with no natural n
cutoff the way Catalan solids' 13 or Johnson's 92 have one) — capped at
n=10, 14 shapes, all now in the registry.
`docs/johnson-solids-remaining-spec.md` diagnosed the 21 Johnson solids
that were originally missing, grouped simplest-first by how well the
failure was understood: **Groups 1-3 are all done** — Group 1 (J66-
J71, all 6) shared one root cause (a specific cupola registration
detail, confirmed via external research, not guessed); Group 2 (J64)
needed an entirely different construction than what was tried (a
tetrahedron on a triangle, not a pyramid on a pentagon); Group 3 (J79)
turned out to be the same class of mistake as Group 2 — the "fix"
this doc first proposed (trace the transform, assuming the plan was
already right) was itself built on a misreading of the same external
source, corrected in batch 11 once re-read precisely. Only Group 4
remains: ~13 shapes with no closed form at all, needing genuinely new
numerical-solver tooling this registry doesn't have yet.
`docs/johnson-solids-constructions.md` distills the 8 Groups 1-3
shapes' construction recipes into a standalone reference (base
shape(s), target-face selection rule, registration parameter, and
verification method for each), alongside a machine-readable open-data
companion, `data/johnson-solids-hard-constructions.json` — every field
in it cross-checked against this registry's own live `POLYHEDRA` data
before being recorded, not transcribed from the narrative postmortems
by hand.
`docs/vercel-deployment-plan.md` records the intended repo/Vercel
layout for when this deploys alongside Rhombiverse.

## Contributing

Humans and AI coding agents are both welcome to open PRs — see
`CONTRIBUTING.md` for how this project actually works and
`CODE_OF_CONDUCT.md` for the community standard.

## Running locally

```
npm install
npm run dev
```

Then open `http://localhost:3000`. `npm run lint`, `npx tsc --noEmit`,
and the `verify:*` scripts (`npm run verify:attach`, etc.) all run
without a browser; `npm run test:e2e` needs Chromium
(`npx playwright install --with-deps chromium`) on whatever machine
runs it.

The primary dev machine is a Raspberry Pi (arm64) — fine for everything
above, but Playwright's Chromium download is slow and occasionally
stalls there. Where a second machine is available (`dicto-node` on the
LAN, reachable over SSH with Chromium already installed), it's worth
using for `npm run test:e2e` and other browser-dependent runs rather
than waiting on the Pi.
