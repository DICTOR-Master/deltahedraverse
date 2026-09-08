# Deltahedraverse

A browser-based construction kit for convex polyhedra — click a free
vertex, snap on a new piece with a free rotational joint, twist it into
place, confirm. Molecular-model-kit mechanics, not tiled building blocks:
started with the 8 convex deltahedra specifically because they don't tile
space and their dihedral angles are incompatible across types, so every
connection is a single-point ball joint, never face-gluing.

The intention is for this to grow into a sibling of
[Rhombiverse](https://github.com/DICTOR-Master/rhombiverse) — a general
polyhedral space-editing suite covering the Platonic and Archimedean
solids and the Johnson solid family alongside the 8 deltahedra, with
face-to-face connections for shapes whose faces geometrically match (not
just vertex-to-vertex), an inside/cutaway view toggle, and its own
introductory geometric-packing puzzle game in the spirit of Rhombiverse's
RHOMBIS (working name: DELTIS). See `docs/build-plan.md`'s trailing
sections for what's actually shipped versus what's still ahead.

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

## Structure

```
deltahedraverse/
  app/
    lib/
      polyhedra/
        core.ts          # family-agnostic infra: PolyhedronSpec, makeSpec, validateShape, triangulateFace
        deltahedra.ts    # the 8 deltahedra, verified against a convex hull
        platonic.ts      # cube + dodecahedron (the 2 Platonic solids not already deltahedra)
        rewrite.ts       # D10<->D12 vertex-matching (pure function, no three.js)
        index.ts         # combined POLYHEDRA / POLYHEDRON_IDS across every family
      assembly.ts        # the real {nodes, connections} graph + validation
      graph.ts           # subtree/cycle graph logic (pure, no three.js)
    components/
      ShapeViewer.tsx    # the whole Three.js scene: render, pick, attach, twist, rewrite, delete
    api/assemblies/      # GET/POST persistence route (local JSON for now; see docs)
    page.tsx             # UI shell around ShapeViewer
  scripts/               # validate-*, verify-attach/twist/rewrite/graph -- run outside the browser
  tests/e2e/             # permanent Playwright suite (npm run test:e2e)
  docs/
    build-plan.md               # the build plan, with how each stage was verified
    construction-kit-spec.md    # the vertex-snapping design law + extensibility notes
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
separately). `docs/vercel-deployment-plan.md` records the intended
repo/Vercel layout for when this deploys alongside Rhombiverse.

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
