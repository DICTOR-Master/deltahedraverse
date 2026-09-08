# Deltahedra Construction Kit

A digital vertex-snapping construction kit for the 8 convex deltahedra (D4,
D6, D8, D10, D12, D14, D16, D20 — named by face count). Users click a vertex,
attach a new deltahedron there, rotate it freely around the connection axis,
confirm. Think molecular-model-kit, not tiled building blocks.

## Stack

Next.js + TypeScript + Three.js, one Vercel deployment — frontend and API
routes together. Do not split into separate frontend/backend projects.

Three.js touches the DOM/WebGL: any component that mounts a scene needs
`'use client'`, and if lazy-loaded via `next/dynamic`, pass `{ ssr: false }`.
Next tries to server-render by default and Three.js throws immediately if it does.

## Core mechanic: vertex-snapping, not face-gluing

Deltahedra do not tile space and their dihedral angles are incompatible
across types — this was checked, don't re-litigate it. Connections happen at
a single vertex with a free rotational joint (ball-joint style), never by
merging faces. This is what makes arbitrary chains/clusters/cages possible.

## Geometry data: app/lib/deltahedra.ts

Already written and verified — unit edge length, each shape centered at its
own centroid, edges/faces/connectors (vertex degree = triangles meeting
there) all cross-checked against a convex-hull computation. Do not re-derive
coordinates from scratch, especially not D12 (snub disphenoid): its
coordinates depend on the positive real root of an irreducible cubic
(2q³+11q²+4q−1=0) — the one deltahedron with no compass-and-straightedge
construction. Hardcoded as `Q_D12` rather than solved at runtime.

See deltahedra.ts in this same folder for the full source.

## Signature feature: the D10↔D12 rewrite rule

Select a pentagonal-bipyramid (D10) node, transform it into a snub disphenoid
(D12) in place. Because D12 doesn't share D10's vertex layout, every existing
connection to that node needs its anchor recomputed on transform — if no
compatible vertex exists in roughly the same role, surface the orphaned
connection to the user rather than silently guessing a placement.

## Adding new polyhedra (modularity)

The registry now lives in `app/lib/polyhedra/` — `core.ts` (family-agnostic
infrastructure: `PolyhedronSpec`, `makeSpec`, `buildConnectors`,
`validateShape`, `triangulateFace`), one file per family
(`deltahedra.ts`, `platonic.ts`, and eventually `archimedean.ts`,
`johnson.ts`), and `index.ts` combining them into `POLYHEDRA`/
`POLYHEDRON_IDS`. This is exactly the shape the original extensibility
notes called for; the two schema limits noted below are done, not
speculative anymore.

**To add a shape**, provide reference vertices (any consistent scale —
`makeSpec` measures the first edge, normalizes to 1, and centers at the
centroid, so exact pre-scaling isn't necessary), an edge list, and a face
list. Degree/connector capacity is *derived* from the edge list, never
hand-declared. This is deliberate, not a style preference: an independently
written version of this same data (`deltaShapes.ts`, uploaded to the
project) hand-declares a `degrees` array that disagrees with its own edge
list for D14 and D16, and its D20 face list has 26 entries where an
icosahedron needs exactly 20, which fails Euler's formula (V−E+F=2) — both
are checked, both are wrong, and both are the specific class of bug that
happens when a fact derivable from another field gets stored and asserted
separately instead. Keep vertices + edges + faces as the only source of
truth; derive the rest.

**For anything beyond a hand-checkable shape (a cube is fine by hand; a
dodecahedron was not), verify computationally before trusting the data.**
The dodecahedron's first attempt — take the 5 vertices with the highest
dot product against a guessed face-normal direction — produced non-planar,
wrong-vertex "faces," because dodecahedron face vertices don't all rank
contiguously by raw dot product against their own face's normal. Fixed by
computing the real 3D convex hull (`scipy.spatial.ConvexHull`) and merging
its triangles by shared plane equation. Johnson solids (92 of them, ahead)
will need this discipline far more than Platonic solids did — don't
hand-derive face lists for anything non-trivial.

**Schema widened for non-triangular faces (done):**
- `PolyhedronSpec.faces` is `number[][]`, not triangle-only.
  `triangulateFace()` (`core.ts`) fan-triangulates any convex n-gon for
  Three.js's `BufferGeometry` at render time, without changing the stored
  data. `ShapeViewer.tsx`'s `buildFaceGeometry` uses it — the earlier
  triangle-only version silently dropped vertices past the third for any
  non-triangular face, which would have rendered broken geometry.
- Nothing else needed to change: vertex degree = incident-edge count =
  incident-face count for *any* convex polyhedron (edges and faces
  alternate once around a manifold vertex, not just a triangulated one) —
  the connector/capacity system from Stage 3 already worked unmodified.
  `validateShape()`'s edge-count check now uses the handshake lemma (sum
  of face sizes / 2 = edge count) instead of the triangle-only
  `faceCount*3/2` formula — same result for deltahedra, correct for mixed
  face sizes too.

**Dual / face-snap mode — done** (user, 2026-09-08: shapes with matching
face geometry should connect via shared faces, plus an inside/cutaway
view toggle). Built exactly as sketched: `buildFaceConnectors()`
(`app/lib/polyhedra/core.ts`) computes `{ faceIndex, size, pos:
centroid(face), normal: outwardNormal(face) }` from `vertices` + `faces`,
no change to `PolyhedronSpec` itself. Two things the original sketch
didn't anticipate, both load-bearing:

- **The remaining "free" rotation isn't free.** Vertex-attach leaves a
  genuinely continuous twist DOF (the axis maps to itself under any
  rotation around it). Two glued, coincident regular n-gon faces don't —
  only *n* discrete registrations keep them flush. The alignment angle
  itself has to be computed analytically (align a reference vertex
  direction via `atan2` in the shared plane), not assumed to be zero or
  searched among "multiples of 360° / n starting from zero" — checked
  broadly (8280 pairs) rather than trusted from the first shape pair
  that happened to work by coincidence. See `build-plan.md` for the full
  story of the wrong turn this took first.
- **Schema**: reuse `vertexA`/`vertexB` as face indices via a
  `kind?: 'vertex' | 'face'` tag, rather than adding parallel `faceA`/
  `faceB` fields — exactly one interpretation is ever meaningful per
  connection, so a discriminant is simpler than a second pair of mostly-
  unused fields. `kind` absent means `'vertex'`, so every save made
  before this existed still validates and loads correctly.

See `build-plan.md`'s own section on this for what's still a known gap
(rewrite doesn't re-match face connections yet — orphans them instead of
guessing) and how it was verified (a real Playwright test against the
actual persisted assembly, not just the placement math).

## Where things stand

See build-plan.md for the staged build order, current progress, and
what's still outstanding beyond the original 8 stages.
