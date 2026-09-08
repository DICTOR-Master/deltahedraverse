# Deltahedraverse

A browser-based construction kit for the 8 convex deltahedra — click a
free vertex, snap on a new piece with a free rotational joint, twist it
into place, confirm. Molecular-model-kit mechanics, not tiled building
blocks: deltahedra don't tile space and their dihedral angles are
incompatible across types, so every connection is a single-point
ball joint, never face-gluing.

The intention is for this to grow into a sibling of
[Rhombiverse](https://github.com/DICTOR-Master/rhombiverse) — a general
polyhedral space-editing suite eventually covering the Platonic and
Archimedean solids and the Johnson solid family alongside the 8
deltahedra already here, with its own introductory geometric-packing
puzzle game in the spirit of Rhombiverse's RHOMBIS (working name:
DELTIS). None of that is built yet — see `docs/build-plan.md`'s "Later"
section for what's speculative versus what's actually shipped.

## What's here now

All 8 stages of the original build plan are done — see
`docs/build-plan.md` for the full stage-by-stage account, including
exactly how each one was verified:

- **Geometry core** (`app/lib/deltahedra.ts`) — vertices, edges, faces,
  and per-vertex degree for all 8 convex deltahedra (D4 through D20,
  named by face count), cross-checked against a convex-hull
  computation. D12 (snub disphenoid) is the one shape with no
  compass-and-straightedge construction — its coordinates come from the
  positive real root of an irreducible cubic, hardcoded rather than
  solved at runtime.
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
      deltahedra.ts      # geometry core: 8 shapes, verified against a convex hull
      assembly.ts        # the real {nodes, connections} graph + validation
      rewrite.ts         # D10<->D12 vertex-matching (pure function, no three.js)
      graph.ts           # subtree/cycle graph logic (pure, no three.js)
    components/
      ShapeViewer.tsx    # the whole Three.js scene: render, pick, attach, twist, rewrite, delete
    api/assemblies/      # GET/POST persistence route (local JSON for now; see docs)
    page.tsx             # UI shell around ShapeViewer
  scripts/               # validate-deltahedra, verify-attach/twist/rewrite/graph -- run outside the browser
  tests/e2e/             # permanent Playwright suite (npm run test:e2e)
  docs/
    build-plan.md               # the 8-stage build plan, with how each stage was verified
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
