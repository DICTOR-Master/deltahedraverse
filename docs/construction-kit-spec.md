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

The registry format already generalizes past deltahedra — extending it is
additive, per the original extensibility notes (Platonic/Archimedean solids,
Johnson solids, dual/face-snap mode). Concretely:

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

**Two schema limits to widen before Platonic/Archimedean solids fit:**
- `faces` is currently typed `[number, number, number][]` — triangles only.
  A cube (square faces) or dodecahedron (pentagon faces) needs
  `faces: number[][]`. Convex non-triangular faces can still fan-triangulate
  for Three.js's `BufferGeometry` at render time without changing the stored
  data.
- Nothing else needs to change: vertex degree = incident-edge count =
  incident-face count for *any* convex polyhedron (edges and faces
  alternate once around a manifold vertex, not just a triangulated one) —
  the connector/capacity system from Stage 3 already works unmodified.

**Dual / face-snap mode** (a rhombiverse-style extension, noted for later —
see vercel-deployment-plan.md's "Independent for now" decision before
building this) needs one new *derived* concept, not a new stored field: a
face connector is `{ faceIndex, pos: centroid(face), normal:
outwardNormal(face) }`, computed from `vertices` + `faces` the same way
vertex connectors are computed from `vertices` + `edges`. No change to
`DeltahedronSpec` itself — just a second `buildFaceConnectors()` alongside
the existing `buildConnectors()`.

## Where things stand

See build-plan.md for the staged build order and current progress.
