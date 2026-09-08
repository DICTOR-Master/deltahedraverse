# Polyhedraverse Build Plan

Check off stages as they're completed. Each stage is a focused session —
don't start the next one until the current "Done when" passes.

- [x] **Stage 0 — Scaffold** ✅ done
  `create-next-app` (TypeScript, Tailwind, App Router), Three.js added,
  one spinning test mesh at `app/components/SpinningMesh.tsx` (later
  superseded by Stage 2's real viewer) mounted client-only via
  `next/dynamic({ ssr: false })`.
  Done when: `npm run dev` shows something rotating. ✅

  Note: originally scaffolded with `yarn` (classic v1) because this
  machine had no `npm`/`npx` at the time (Debian package split `npm`
  out of `nodejs`). `npm` was installed later; the project now runs on
  `npm` throughout (`package-lock.json`, `yarn.lock` removed) — same
  scripts, same behavior.

- [x] **Stage 1 — Geometry core** ✅ done, see `app/lib/deltahedra.ts`
  (deltahedra.ts in this same folder)
  Vertices (unit edge length), edges, faces, per-vertex degree, for all 8
  shapes. `validateShape()` checks every edge ≈1 and every face equilateral.
  Done when: all 8 pass validation.

- [x] **Stage 2 — Static render + palette** ✅ done
  Picker (`app/page.tsx`) of all 8 IDs; `app/components/ShapeViewer.tsx`
  builds a non-indexed flat-shaded mesh straight from each spec's
  `faces` (computeVertexNormals on non-indexed geometry = per-face flat
  normals) plus a `LineSegments` outline built directly from `edges`
  (exact data, not a heuristic edge-angle threshold). OrbitControls for
  spawn-and-orbit.
  Done when: you can spawn and orbit any of the 8. ✅ (verified via dev
  server response + lint; no local/extension browser was available this
  session to click through interactively — worth a manual sanity check).

- [x] **Stage 3 — Vertex picking** ✅ done
  `ShapeViewer.tsx`: an invisible (opacity 0), `depthTest: false` sphere
  per vertex (`buildVertexGroup`), raycast on `pointermove` against that
  group only (not the shape's faces). On hit: sphere opacity → 1, scale
  1.6x, and a floating label reads `vertex {id} — capacity {degree}`
  straight from `spec.connectors[i].degree` — no separate stored field,
  same derive-don't-duplicate rule as the rest of the geometry core.
  "Capacity" is the full vertex degree for now since nothing has been
  attached yet (Stage 4/6 will start consuming it).
  Done when: hovering any vertex on any shape shows correct capacity.
  ✅ (verified via dev server response + lint + tsc; no local/extension
  browser was available this session to hover-test interactively —
  worth a manual sanity check, same caveat as Stage 2).

- [x] **Stage 4 — Attach** ✅ done
  `ShapeViewer.tsx` now holds an assembly (`placedRef: PlacedShape[]`)
  instead of one shown shape. Click a free (non-occupied) vertex to
  select it as the target; the "Attach" row in `page.tsx` then places a
  new instance:
  - `setFromUnitVectors(attachLocalDir, -targetWorldNormal)` — the
    align-two-vectors quaternion — rotates the incoming shape's own
    vertex-0 outward direction to point *opposite* the target's outward
    normal, so it continues growing away from the existing structure.
  - Target world position/normal are read via `getWorldPosition` /
    `getWorldQuaternion` off the target's own parent chain (not assumed
    to be the root), so attaching to a vertex on an already-attached
    piece works too — chaining wasn't explicitly asked for yet, but
    falls out for free from using Object3D's API correctly.
  - Both the target vertex and the incoming shape's vertex-0 are marked
    `occupied` afterward (gray, no longer selectable) — the minimal
    "free vertex" bookkeeping this stage needs; the real assembly graph
    is Stage 6.
  - Incoming shape's own connecting vertex is fixed at index 0 by
    convention — Stage 4/5 never ask the user to choose it, only build
    plan stages, so this can be revisited later if that turns out wrong.
  Done when: attaching any shape to any free vertex lands clean, no
  clipping. ✅ Verified two ways: `npm run verify:attach` replicates the
  exact placement math outside the browser and checks, for all 8×8
  shape pairs across every vertex of the root shape (488 cases): (1)
  the incoming shape's vertex-0, once transformed, lands exactly on the
  target vertex (coincidence error < 1e-9), and (2) the incoming
  shape's centroid ends up strictly farther from the root's centroid
  than the shared point along the connection axis (grows outward, not
  back into the parent). Also verified `npm run lint` / `npx tsc
  --noEmit` clean and the dev server serves the new UI with no errors;
  no browser was available this session to click-test interactively —
  same caveat as Stages 2–3, worth a manual pass.

- [x] **Stage 5 — Rotate, then confirm** ✅ done
  `beginAttach()` now places the incoming shape as a *pending* attach
  instead of committing immediately: `OrbitControls.enabled = false`
  (so drag means twist, not camera orbit) while pending, and dragging
  updates `twistAngle`, applying
  `baseQuaternion.multiply(setFromAxisAngle(attachLocalDir, twistAngle))`
  each move — twisting around the incoming shape's own connection axis
  never moves that axis itself, so the shared point stays fixed no
  matter the angle. `confirmAttach()` locks it into the assembly
  (occupied markers stay set, orbit re-enabled); `cancelAttach()` —
  wired to both a Cancel button and the Esc key — removes the pending
  piece and flips its target vertex back to free ("restores capacity").
  `page.tsx`'s attach row is replaced by a "Placing {shape} — drag to
  twist" row with Confirm/Cancel while pending.
  Done when: drag rotates the pending piece, Confirm commits, Esc
  cancels and restores capacity. ✅ `npm run verify:twist` checks the
  core claim directly (1152 cases: 8×8 shape pairs, first/last root
  vertex, 9 angles from 0–359°) — the incoming shape's connecting
  vertex stays coincident with the target to within 1e-9 at every
  angle, i.e. twisting truly is the one free rotational DOF and never
  drifts the shared point. `npm run lint` / `npx tsc --noEmit` /
  `verify:attach` / `validate:deltahedra` all still pass, dev server
  serves the new UI with no errors; no browser was available this
  session to actually drag-test the twist by eye — same caveat as
  Stages 2–4.

- [x] **Stage 6 — Assembly graph** ✅ done (with one deliberate deviation — see below)
  `app/lib/assembly.ts` defines exactly the shape the plan names:
  `{ nodes: [{id, shape, transform}], connections: [{nodeA, vertexA,
  nodeB, vertexB}] }`, plus `isValidAssembly()` — structural checks
  *and* semantic ones (every `shape` is a real deltahedron id, every
  connection's node ids and vertex indices actually exist).
  - `ShapeViewer.tsx` now keeps `graphRef: Assembly` as real state,
    mutated only at the two points user actions actually happen:
    `placeRoot()` (root node) and `confirmAttach()` (new node + new
    connection, using the parent's `nodeId` and the target vertex's
    index — never re-derived by walking the scene). `loadAssembly()`
    goes the other direction: rebuild the scene, including which
    vertices are `occupied`, purely from a graph that was handed to it.
  - **Deviation**: the plan names Vercel KV or Postgres for
    `app/api/assemblies/route.ts`. Neither is provisioned (would need
    the user's Vercel account/cloud resources, out of scope for this
    session per `vercel-deployment-plan.md`'s own "independent for
    now"/not-yet-deployed stance). Implemented instead as a local JSON
    file (`.data/assembly.json`, gitignored) behind the exact same
    GET/POST route contract. Swapping the two storage functions
    (`loadStored`/`saveStored`) for a KV/Postgres client is the entire
    migration once the project actually deploys — everything else
    (validation, the graph shape, the client code) is unaffected.
  - `ShapeViewer` fetches `/api/assemblies` on mount and loads it if
    non-empty and valid, otherwise falls back to `initialShapeId`.
    `page.tsx` adds a header Save button with saving/saved/error
    feedback.
  Done when: reload restores a saved assembly exactly. ✅ Verified
  against the real running dev server (not just unit-level): POSTed a
  two-node/one-connection sample, GET returned it byte-for-byte
  identical; POSTed two invalid payloads (unknown shape id, garbage
  object) and both were rejected 400 with the valid data left
  untouched; **restarted the dev server process entirely** and
  confirmed the assembly was still there — a stronger proof than a
  mere browser reload, since it rules out any in-memory-only state.
  `npm run lint` / `npx tsc --noEmit` / `validate:deltahedra` /
  `verify:attach` / `verify:twist` all still pass. No browser was
  available this session to click Save and watch a real page reload
  restore the 3D scene by eye — same caveat as every prior stage, but
  the persistence layer itself (the part that's actually new here) was
  exercised end-to-end over real HTTP.

- [x] **Stage 7 — D10↔D12 rewrite rule** ✅ done
  - `app/lib/rewrite.ts`: `matchRewriteVertices(oldSpecId, newSpecId,
    oldVertexIndices)` — a pure, `three`-free function (plain number
    tuples), factored out rather than duplicated like the earlier
    verify scripts, because a greedy bipartite match is genuinely
    non-trivial and worth keeping in one place. "Roughly the same
    role" = most similar outward direction (both shapes centered, so
    vertex position doubles as direction), assigned highest-score-first,
    1:1. Threshold (cos ≥ 0.5, i.e. within 60°) checked empirically in
    `scripts/verify-rewrite.ts` against real D10/D12 data — every
    single vertex's best possible match is within 36.7° worst-case, so
    for this specific pair orphaning only ever comes from genuine
    greedy-assignment conflicts, never from poor geometric fit.
  - Clicking a D10 or D12 node's *body* (not a vertex — a second,
    lower-priority raycast against face meshes, checked only when no
    vertex sphere is hit) selects that whole node for rewrite; a
    "Transform to D12/D10" button appears in `page.tsx`.
  - `rewriteSelectedNode()` in `ShapeViewer.tsx`: swaps the node's
    `PlacedShape` in place (same node id, same world position/quaternion),
    matches its active (non-orphaned) connections' old vertices onto the
    new shape, updates `graphRef` (the node's `shape` field, and each
    matched connection's vertex index) — and, critically, **never reads
    or writes any other node's transform or graph record**. Orphaned
    connections get `orphaned: true` (schema addition — see
    `AssemblyConnection.orphaned` in `app/lib/assembly.ts`; validation
    skips the now-stale vertex-index range check for them, and
    `loadAssembly()` skips marking anything occupied for them). The
    result (`{fromSpecId, toSpecId, reattached, orphaned}`) surfaces to
    the user as a transient banner rather than a guessed placement.
  Done when: transforming a D10 with 2 attached neighbors doesn't send
  them flying. ✅ Verified past pure-function level: built the exact
  scenario (D10 root, two D4 neighbors each attached at a different
  root vertex) as a real assembly, POSTed it to the running dev
  server, computed the rewrite bookkeeping the same way
  `rewriteSelectedNode` does, POSTed the result, and confirmed via a
  fresh GET that both neighbor node records are **byte-identical**
  before and after (the actual "didn't send them flying" claim,
  checked at the data level since neighbor transforms are never in any
  code path this stage touches) while the root's shape flipped to D12
  and both connections reattached with no orphans. `npm run lint` /
  `npx tsc --noEmit` / `validate:deltahedra` / `verify:attach` /
  `verify:twist` / `verify:rewrite` all still pass. No browser to click
  a node body and watch the swap by eye — same caveat as every prior
  stage.

- [x] **Stage 8 — Polish** ✅ done (one feature honestly noted as currently inert)
  - `app/lib/graph.ts` — pure graph-logic helpers, no Three.js, no
    geometry: `collectSubtree()` (BFS over nodeA -> nodeB edges — every
    connection is created by `confirmAttach` as parent -> child, so the
    graph the app can build is always a rooted tree, making "subtree"
    well-defined), `findParentConnection()` (the one inbound edge, or
    none for the root), and `hasCycle()` (standard union-find over
    connections treated as undirected edges — a "closed cage").
    `scripts/verify-graph.ts` checks both against 11 hand-built graphs
    (a tree, a forest, a triangle, a self-loop, isolated nodes).
  - **Capacity glow**: `applyNodeAppearance()` in `ShapeViewer.tsx`
    tints a node's whole body with a faint emissive glow whenever it
    still has a free vertex (pure counting over the same `occupied`
    flags the per-vertex hover tooltip already reports), called after
    every operation that changes a node's own occupied vertices
    (attach/cancel/rewrite/delete/load). Node selection (for delete or
    rewrite) always overrides the glow with its own highlight color.
  - **Cascade-remove**: node-body selection is generalized beyond
    D10/D12 (Stage 7 gated it to rewritable shapes only) — clicking
    any node's body now selects it, and `page.tsx` always shows a
    Delete button (Transform only appears when `rewriteTarget` is
    non-null). `deleteSelectedNode()` removes the selected node and
    its whole subtree via `collectSubtree`, frees the parent's own
    vertex via `findParentConnection` (a no-op for the root — deleting
    the root clears the whole assembly), and — like Stage 7's rewrite —
    never touches any node outside what's actually being deleted.
  - **Cycle detection — honest limitation**: `hasCycle()` is correct
    and unit-tested, wired to report a "Closed cage!" badge in
    `page.tsx` after every graph mutation, but it can never actually
    fire through this app's own UI today: `confirmAttach` only ever
    creates a brand-new node, never links two already-placed nodes, so
    every graph this app can build is provably a tree. Noted here
    rather than silently shipped as a dead feature — it's a correct,
    ready primitive for a future "connect two existing free vertices"
    interaction (an actual "closed cage" goal), not a working goal
    system yet.
  Done when (this stage has no single stated "done when" line in the
  original plan beyond "pure graph logic, no 3D math" — verified that
  constraint directly: `graph.ts` imports nothing from `three`).
  ✅ Verified end-to-end against the real running dev server: built a
  4-node tree (root, childA, a grandchild under childA, childB),
  computed the same cascade the app's own `deleteSelectedNode` would,
  and confirmed via a fresh GET that exactly `{root, childB}` and the
  `root -> childB` connection survived — `childA` and its grandchild
  both gone, nothing else touched. `npm run lint` / `npx tsc --noEmit`
  / `validate:deltahedra` / `verify:attach` / `verify:twist` /
  `verify:rewrite` / `verify:graph` all pass. No browser to click a
  node, watch it glow, delete it, or trigger the (currently
  unreachable) cage badge by eye — same caveat as every prior stage.

All 8 build-plan stages are now done. `docs/vercel-deployment-plan.md`
covers what's next (repo/Vercel layout) when this project is ready to
deploy; the "Later" section below covers genuinely-speculative
additions (Platonic/Archimedean packs, Johnson solids, face-snap mode)
that were never part of these 8 stages.

## Permanent browser test suite

Every stage above was, at the time, verified only via lint/tsc/geometry
scripts and direct API calls — never by actually clicking through the UI in
a browser, since this machine has none. That gap got closed once (real
manual click-through on a separate headless machine, `dicto-node`, over
Playwright), and the same scenarios are now a permanent suite under
`tests/e2e/` (`npm run test:e2e`, config in `playwright.config.ts`):

- `render.spec.ts` — page loads, canvas renders, all 8 shape buttons present.
- `attach.spec.ts` — select a free vertex, attach, twist, confirm; and the
  cancel path frees the vertex again.
- `rewrite.spec.ts` — D10 body offers "Transform to D12"; applying it swaps
  the shape (checked by the node then offering the reverse transform).
- `delete.spec.ts` — deleting a root with one attached child cascades
  correctly and leaves the canvas empty.
- `persistence.spec.ts` — Save, reload, and the same vertex reads occupied
  again (the attached child specifically survived, not just the root shape).

This machine still has no browser, so `test:e2e` can't run here — it needs
Chromium (`npx playwright install --with-deps chromium`) on a machine that
has one, same as this session used `dicto-node` for. One real lesson from
building this suite: vertices are cheap to find by sweeping the mouse across
the canvas and reading the hover tooltip (they're small, scattered targets),
but a *node's body* is not — most of a small polyhedron's visible face is
within a vertex's hit radius, so few sweep positions are "face, no vertex
nearby," and a blind sweep for one was slow enough to blow past a 90s test
timeout. Fix: a root node's centroid is always the world origin, which
projects to the canvas center under the default camera, so
`findNodeBody()`/`readTooltipAt()` check dead-center directly first and only
fall back to a full sweep if that misses.

## Beyond the original 8 stages: Platonic solids

The user expanded the intended scope (2026-09-08): grow into a genuine
sibling of Rhombiverse covering all polyhedral families, not just the 8
deltahedra. First step, done:

- **Restructured `app/lib/deltahedra.ts` into `app/lib/polyhedra/`** — a
  directory per the "all inclusive appropriate directories" instruction,
  organized to scale as more families get added:
  - `core.ts` — family-agnostic infrastructure (`PolyhedronSpec`,
    `makeSpec`, `buildConnectors`, `validateShape`, and a new
    `triangulateFace()` fan-triangulation helper for rendering non-triangular
    faces). `PolyhedronSpec.faces` widened from `[number,number,number][]`
    to `number[][]` — exactly the two schema changes
    `construction-kit-spec.md` had already called out as needed before
    Platonic/Archimedean solids would fit, and nothing else needed to
    change (vertex degree = incident-edge count = incident-face count for
    *any* convex polyhedron).
  - `deltahedra.ts` — the same 8 shapes, now importing shared infra from
    `./core` instead of defining it locally.
  - `platonic.ts` — the 2 Platonic solids not already covered by
    deltahedra (tetrahedron/octahedron/icosahedron are already D4/D8/D20 —
    not re-derived): cube and dodecahedron.
  - `rewrite.ts` — the D10<->D12 rewrite rule, moved alongside deltahedra
    since it's specific to that family.
  - `index.ts` — combined `POLYHEDRA`/`POLYHEDRON_IDS` across every
    family, used by the shape picker and assembly validation; family
    files stay independently importable for family-specific logic.
- **Cube**: hand-derived (8 vertices, 6 square faces) and cross-checked
  computationally.
- **Dodecahedron**: the harder case, and a real lesson worth recording —
  a first attempt derived each face by taking the 5 vertices with the
  highest dot product against a guessed face-normal direction (the
  icosahedron-vertex directions, since dodecahedron/icosahedron are
  duals). That produced non-planar, wrong-vertex "faces": dodecahedron
  face vertices don't all rank contiguously by raw dot product against
  their own face normal, so top-k selection silently grabbed a vertex
  from a neighboring face instead. Fixed by computing the actual 3D
  convex hull (`scipy.spatial.ConvexHull`) and merging its triangles by
  shared plane equation — no geometric assumptions, just the real
  topology. Verified: 20 vertices, 30 edges, 12 pentagonal faces, all
  planar, all edges equal length, vertex degree 3 everywhere, Euler
  V-E+F=2.
- **`validateShape()` generalized** for n-gon faces (checks every
  consecutive boundary edge of every face, not just a triangle's 3
  sides) and its edge-count check now uses the handshake lemma
  (sum of face sizes / 2 = edge count) instead of the triangle-only
  `faceCount*3/2` formula — reduces to the same result for deltahedra,
  generalizes correctly for mixed face sizes.
- **`buildFaceGeometry` in `ShapeViewer.tsx` fixed** to fan-triangulate
  each face via `triangulateFace()` instead of destructuring `[i,j,k]`
  directly — the old code silently dropped vertices past the third for
  any non-triangular face, which would have rendered broken geometry for
  cube/dodecahedron without this fix.
- **Verification widened, not just added**: `scripts/verify-attach.ts`
  and `verify-twist.ts` now run across the *combined* `POLYHEDRA`
  registry (890 and 1800 checks respectively, up from 488/1152) — the
  attach/twist math only depends on vertex positions, never face shape,
  so this is a real generalization check, not just more of the same.
  `scripts/validate-platonic.ts` mirrors `validate-deltahedra.ts` for the
  2 new shapes. `tests/e2e/render.spec.ts` gained a real-browser check
  that a non-triangulated shape (cube) actually renders and its vertices
  are hoverable — the one thing the pure-math scripts can't catch, since
  they never touch `buildFaceGeometry`. Full suite (unit-level +
  Playwright, 8/8) re-run and passing after the restructure.

## Face-to-face connections (face-snap mode) and the view toggle

The user's next ask (2026-09-08): shapes with matching face geometry
should connect via shared faces, not just vertex-to-vertex, plus an
inside/cutaway view toggle. Both done:

- **`buildFaceConnectors()`** (`app/lib/polyhedra/core.ts`) — the
  face-snap-mode primitive `construction-kit-spec.md` already sketched:
  `{faceIndex, size, pos: centroid(face), normal: outwardNormal(face)}`,
  derived from `vertices` + `faces` the same way vertex connectors derive
  from `vertices` + `edges`. The outward normal comes from the face's own
  CCW winding, so `scripts/verify-face-connectors.ts` (334 checks) is
  also a genuine cross-check of that winding for every face of every
  shape — not just an assumption repeated — via a universal property: for
  a convex shape centered at the origin, `dot(face_centroid,
  outward_normal)` must be positive for every face.
- **The attach math took a real wrong turn worth recording.** First
  assumption: align the two faces' normals (opposite directions, same
  principle as vertex-attach), then the remaining twist must be one of
  the *n* multiples of 360/n starting from "zero extra twist." Checked
  broadly (8280 matching-size face pairs) rather than trusting the first
  passing example: only 1188 actually coincided at zero twist, and a
  wider sweep confirmed varying the twist by multiples of 360/n often
  changed nothing (D4-D4 self-attach: stuck at the same 1.7321 error for
  every one of the 3 candidates) — the polygon vertex *set* was fixed
  under that whole family, just *mirrored* relative to the target. The
  fix: compute the twist angle **analytically** — align the incoming
  face's own vertex-0 direction to where target's vertex-0 needs it to
  be, via `atan2` in the shared plane — rather than assuming zero or
  searching discrete multiples from zero. That fixed all 8280 pairs
  exactly (`scripts/verify-face-attach.ts`). A real, physical sanity
  check for why this had to be solvable: D6 (triangular bipyramid) *is*
  two regular tetrahedra glued face-to-face, already sitting in the
  registry — if gluing two D4s together weren't achievable by pure
  rotation, D6 couldn't exist as a valid unit-edge shape either.
- **Discrete registration cycling**: unlike vertex-attach's continuous
  twist, two coincident regular n-gon faces have no free rotation — only
  *n* discrete states (rotating a regular n-gon by any multiple of
  360/n around its own center maps it onto itself), verified directly
  in `scripts/verify-face-twist.ts` (order-independent — checks the
  vertex *sets* coincide, not a presumed index-correspondence formula,
  since which specific vertex lands where isn't something either the
  app or the geometry needs to track). Dragging during a pending
  face-attach accumulates pixel distance and steps through registrations
  in whole increments, unlike vertex-attach's continuous angle.
- **Schema**: `AssemblyConnection` gained an optional `kind?: 'vertex' |
  'face'` tag (absent ≡ `'vertex'`, preserving every save made before
  this existed) rather than separate `faceA`/`faceB` fields — reuses
  `vertexA`/`vertexB` as face indices when `kind === 'face'`, since
  exactly one interpretation is ever meaningful per connection.
  `isValidAssembly` checks the index range against `faces.length` or
  `vertices.length` accordingly.
- **Interaction**: clicking a node's body already selected it for
  delete/rewrite (Stage 7/8) — extended, not replaced: the same click
  also captures which specific triangle (hence which polygon face, via a
  `triangleToFaceIndex` map built alongside fan-triangulation) was under
  the cursor. If that face is free, `page.tsx` offers "Attach {shape}
  via face" buttons for every registered shape sharing that face size —
  currently CUBE-CUBE and DODECAHEDRON-DODECAHEDRON self-pairs, plus any
  two of the 8 triangular-faced deltahedra, since Archimedean/Johnson
  solids aren't in yet.
- **A real gap, honestly left open rather than silently guessed**: the
  D10<->D12 rewrite rule only re-anchors *vertex* connections. A face
  connection on a node being rewritten is marked orphaned unconditionally
  — re-matching a face by normal-similarity the way vertices are
  re-matched by direction is a real, doable extension, just not built
  yet.
- **View toggle**: `ShapeViewer.setViewMode('normal' | 'translucent' |
  'skeleton')`, applied to every placed (and pending) shape's material.
  Skeleton mode keeps the mesh technically visible at ~0.04 opacity
  rather than `.visible = false` — Three.js's `Raycaster` skips invisible
  objects, which would have silently broken node/face selection while
  looking "inside" a structure.

Verified end-to-end, not just at the math level: a real Playwright test
(`tests/e2e/face-attach.spec.ts`) selects a CUBE's face, attaches a
second CUBE via face, drags to cycle the discrete registration, confirms,
and checks the **actual persisted assembly** (via `/api/assemblies`,
since the newly-attached cube now genuinely occludes the root at the
original screen position — real 3D occlusion, not a bug, that a naive
re-hover check got fooled by on the first attempt) — 2 CUBE nodes, 1
`kind: 'face'` connection. `tests/e2e/view-mode.spec.ts` checks the
3-way cycle. Full suite: 11/11 passing, lint/tsc clean, all 9
verification scripts passing (334 + 8280 + 201 new checks for this
feature alone).

## Archimedean solids — first batch of 3

13 Archimedean solids exist; this batch covers 3 with simple,
low-transcription-risk coordinates (cuboctahedron, truncated tetrahedron,
truncated octahedron), deliberately deferring the harder 10 (several need
golden-ratio coordinates or a numerically-solved root for the two chiral
snub solids — the same category of problem `Q_D12` already handles for
deltahedra) to a follow-up rather than rushing them. `app/lib/polyhedra/archimedean.ts`.

**Two real transcription bugs caught here, both instructive:**

1. Cuboctahedron and truncated octahedron's vertices were generated by a
   fresh TypeScript loop (permutations × sign combinations) while the
   edges/faces arrays were copied from a Python script's
   `sorted(set(...))`-ordered convex-hull output. The two orderings
   didn't match — Python's dedup-and-sort reorders vertices relative to
   generation order — so the edge/face indices silently pointed at the
   *wrong physical vertices*. `validateShape()` caught it immediately:
   every single edge came back the wrong length, since edges connected
   unrelated vertex pairs. Fixed by hardcoding the literal vertex list
   copied directly from Python's own printed output instead of
   re-deriving an ordering that has to match a separately-computed index
   list.
2. Truncated tetrahedron's edge list wasn't actually derived from
   anything — the verifying Python script never printed an edge list for
   it (only vertices and faces), so the `EDGES_TRUNCATED_TETRAHEDRON`
   array in the first draft was hand-guessed and included pairs that
   don't appear on any face boundary at all (e.g. `[0,6]`) — again caught
   immediately by `validateShape()`. Fixed the right way: derive edges
   *mechanically* from the already-verified faces array (dedup every
   face's own consecutive vertex pairs) rather than transcribe a second,
   independent list that has to happen to agree with the first.

Both bugs are the same root cause from the Platonic-solids section above,
recurring: two pieces of data that must agree, computed independently
instead of one being derived from the other. `validateShape()` earns its
keep again — this is exactly what it's for.

**Verification widened again, not just added**: `verify-attach.ts` (1781,
up from 890), `verify-twist.ts` (3042, up from 1800), `verify-face-connectors.ts`
(445, up from 334 — new compatibility groups: CUBOCTAHEDRON now shares
triangles with all 8 deltahedra and squares with CUBE; the two truncated
solids share hexagons with each other), `verify-face-attach.ts` (11016,
up from 8280), `verify-face-twist.ts` (321, up from 201). New
`validate-archimedean.ts` mirrors the other family validators.
`tests/e2e/render.spec.ts` gained a hexagon-face render/hover check
(truncated tetrahedron) — n=6 fan-triangulation had never been exercised
in a real browser before (CUBE only exercised n=4, DODECAHEDRON n=5).
Full suite: 12/12 Playwright tests, lint/tsc clean, all 10 verification
scripts passing, on both this machine and dicto-node.

## Archimedean solids — the remaining 10 (batch 2, 2026-09-08)

All 13 Archimedean solids now exist. The user's ask was explicit: continue
past the first-batch-of-3 deferral and finish the family. Same method as
before (convex-hull cross-check, `validateShape()`, never hand-transcribe
what can be derived), applied to genuinely harder coordinates this time.

**Sourcing the raw coordinates.** 9 of the 10 came from each shape's own
Wikipedia "Cartesian coordinates" section (fetched, not recalled from
memory — recalling irrational-coordinate formulas by heart is exactly the
kind of unverified claim this project's own "derive, don't duplicate"
ethos rules out). The 10th,
the truncated icosahedron, has no such section on its Wikipedia page at
all — it's derived instead by 1/3-edge truncation of D20 (this project's
own icosahedron), the same relationship truncated_tetrahedron's own
header comment already describes for the tetrahedron. This is exact, not
approximate, for a real geometric reason: truncating any
all-equilateral-triangle-faced solid at parameter *t* along every edge
produces new-polygon edges of length *t·L* regardless of vertex degree
(law of cosines on the triangle's 60° corner — the two cut points and the
shared vertex form a triangle with two sides of length *t·L* meeting at
60°, so the third side is also *t·L*), and the leftover original-edge
segment has length `(1 - 2t)·L`; setting those equal gives *t* = 1/3
universally, independent of the triangle-faced solid's vertex degree.

**A real transcription bug, caught by the same kind of cross-check this
project has hit twice before.** The first fetch of the snub cube's
Wikipedia page summarized its defining cubic (for the tribonacci-like
constant `t` in its `(±1, ±1/t, ±t)` chiral vertex construction) as
`t³ = t² + 1`. Trusting that root and building the hull produced a solid
with **two different edge lengths** (0.965 and 1.712) instead of one
uniform length — an immediate, loud, unmissable signal, not a subtle one.
The actual tribonacci constant satisfies `t³ = t² + t + 1` (t ≈ 1.83929);
using the correct root collapsed both hull edge lengths to one exact
value. This is the same failure class as the dodecahedron's non-planar
"top-k by dot product" faces and the truncated tetrahedron's hand-guessed
edge list — a claim taken on trust instead of verified computationally —
just one level upstream this time: in the *source coordinates*, not the
transcription of already-correct coordinates into TypeScript. The fix
generalizes the lesson: verify the number before it ever reaches code, not
just the code once the number is in it.

**The snub dodecahedron has no permutation-style formula at all** — unlike
every other shape here, Wikipedia gives it as a single seed point `p` plus
two 3×3 rotation matrices `M1` (claimed order 5) and `M2` (claimed order
3), whose combined orbit under repeated multiplication is the 60 vertices.
Both matrices were verified to actually satisfy that claim — orthogonal,
determinant 1, `M1^5 = I`, `M2^3 = I` — before being trusted, rather than
transcribed and assumed correct; had the fetched entries been wrong, the
resulting point orbit almost certainly wouldn't have closed at exactly 60
points; it did, exactly.

**A second, subtler precision bug, caught by `verify-face-attach.ts` (not
`validateShape()`).** The first version of every batch-2 vertex array was
printed with raw coordinates rounded to 9 decimal places — but
`verify-face-attach.ts`'s face-coincidence check uses a `1e-9` absolute
tolerance, so that rounding put transcription noise right at the edge of
what the check considers a match. Result: 59,440 of 105,016 face-attach
placements "failed" — not a geometry bug, a self-inflicted precision
budget too tight for its own tolerance. Worse for the snub dodecahedron
specifically: its BFS vertex-orbit generator was rounding coordinates to
9 decimals **at the point they were stored**, not just for the
membership-dedup key, baking the same noise into the source data itself.
Both fixed the same way: keep the dedup key coarse (9dp is plenty to
detect "already visited this vertex") but store and print the *full*
float64 value (Python's `repr()`, the shortest string that round-trips to
the identical double) rather than a rounded one. Re-ran clean: 0/105,016
failures. Recorded here because it's a real, non-obvious failure mode
specific to literal-array-of-irrational-coordinates data — precision loss
during transcription can silently violate a downstream script's tolerance
even when the shape itself validates fine, and the fix is to never round
below what the tightest consumer downstream actually needs.

**Registry/UI**: no shape-picker code changes needed — `page.tsx` and
`ShapeViewer.tsx` were already generic over `POLYHEDRON_IDS`/`POLYHEDRA`
from batch 1. `tests/e2e/render.spec.ts` grew from 13 to all 23 shape IDs
in its button-visibility check, plus a new decagon-face (n=10) hover
check on the truncated dodecahedron — the largest face-size in the
registry, never exercised in a real browser before (batch 1 topped out at
n=6).

Verified end to end: `validate-archimedean.ts` (all 13 OK), lint/tsc
clean, `verify:attach` (14,881), `verify:twist` (9,522), `verify:rewrite`,
`verify:graph`, `verify:face-connectors` (1,703 — new compatibility
groups spanning every new shape's face sizes), `verify:face-attach`
(105,016, 0 failures after the precision fix above), `verify:face-twist`
(840), and the full Playwright suite (13/13, including a new decagon-face
n=10 render/hover check, this registry's largest face size), all run on
both this machine and dicto-node (the Pi's local Playwright/Chromium
install is slow and stalls occasionally — see README.md's "Running
locally" section for the dicto-node fallback).

## Johnson solids — a first batch of 6 (2026-09-08)

92 Johnson solids exist (any strictly-convex, regular-faced polyhedron
that isn't already Platonic, Archimedean, a prism, or an antiprism). 5 of
the 92 are already in this registry as deltahedra — J12 (triangular
bipyramid = D6), J13 (pentagonal bipyramid = D10), J17 (gyroelongated
square bipyramid = D16), J51 (triaugmented triangular prism = D14), and
J84 (snub disphenoid = D12) — deliberately not re-derived, same principle
`platonic.ts` already applies to D4/D8/D20. That leaves 87 new. Unlike
the deltahedra/Platonic/Archimedean families, most Johnson solids have no
symmetry-group permutation formula at all — this batch picks the 6 that
genuinely do have closed-form coordinates (no numerical root-finding),
deferring the composite augmented/diminished/gyrate/elementary-but-
irregular solids that make up the bulk of the family to later batches.

**J1 (square pyramid) and J2 (pentagonal pyramid)**: a regular n-gon base
capped with a single apex. Every lateral face must be an equilateral
triangle, so with base circumradius `R_n = 1/(2*sin(pi/n))`, the apex
height solves `R_n^2 + h^2 = 1` — real only for n=4,5 (n=3 degenerates to
a regular tetrahedron, already Platonic and excluded by definition; n≥6
has R_n≥1, no valid apex).

**J3/J4/J5 (triangular/square/pentagonal cupola)**: a smaller top n-gon at
height h above a larger bottom 2n-gon, joined by n alternating squares
and triangles. Top vertex j sits angularly centered above bottom edge
`(2j, 2j+1)`, offset by `pi/(2n)` from bottom vertex `2j`; requiring that
lateral edge equal 1 gives a single closed-form equation for h (law of
cosines in the vertical triangle formed by the two radii and that angular
offset): `h^2 = 1 - R_n^2 - R_2n^2 + 2*R_n*R_2n*cos(pi/(2n))`. Top-top and
bottom-bottom edges are already unit length by construction (R_n and R_2n
are each the correct circumradius for a unit-edge n-gon), so this one
equation is everything h needs to satisfy.

**J6 (pentagonal rotunda)**: not built from a formula at all — derived
directly from this registry's own `ICOSIDODECAHEDRON`. Projecting its 30
vertices onto a 5-fold axis (through a pentagon face's centroid) splits
them into 4 bands of 5/5/10/5/5, with the middle 10 exactly coplanar (a
regular decagon "equator") — confirmed numerically, not assumed from
symmetry alone. Taking the closed half (10 equatorial + 5 + 5 = 20
vertices, exactly matching J6's known vertex count) and re-hulling turns
that flat cross-section into a real decagon face automatically. The
pentagonal rotunda genuinely *is* half an icosidodecahedron, not a
coincidental resemblance — deriving it this way sidesteps re-deriving
golden-ratio coordinates from scratch, the same "derive from an
already-verified shape" principle `TRUNCATED_ICOSAHEDRON` already uses on
D20 in `archimedean.ts`.

All 6 closed-form derivations were still cross-checked the same way as
every other shape in this registry — a real `scipy.spatial.ConvexHull`
computation, edge-length uniformity, and vertex/edge/face counts against
each solid's known values — not trusted from the formula alone. All 6
matched on the first attempt (no transcription bugs this batch — the
closed-form approach has less room for the ordering-mismatch class of bug
that hit earlier batches, since there's no independent second data source
to disagree with the vertex list).

**A genuinely new UI-testable property**: every prior shape in this
registry is vertex-transitive (every vertex has the same degree). J1's
apex has degree 4 while its 4 base vertices have degree 3 — the first
shape with more than one vertex-capacity value. `tests/e2e/render.spec.ts`
gained a real-browser check that hovering finds the degree-4 apex
specifically, not just *a* vertex.

Verified end to end: `validate-johnson.ts` (all 6 OK), lint/tsc clean,
`verify:attach` (20,706), `verify:twist` (15,138), `verify:rewrite`,
`verify:graph`, `verify:face-connectors` (1,883 — J3/J4/J5/J6 open new
6-gon/8-gon/10-gon compatibility groups alongside the Archimedean
truncated solids), `verify:face-attach` (129,258, 0 failures on the first
run), `verify:face-twist` (1,524), and the full Playwright suite (29
shape buttons plus the new apex-hover check), on both this machine and
dicto-node.

Still outstanding for Johnson solids: the remaining 87 (elongated/
gyroelongated pyramids-cupolas-rotunda next, most needing one more
parameter than this batch but still closed-form; augmented/diminished/
gyrate composites and the ~15 solids with no closed form at all, needing
genuine numerical optimization, saved for last).

## PolyhedralWheel — a dodecahedron-shaped 3D shape picker (2026-09-08)

The user's next ask: "copy the UI and HUD wheel idea from rhombiverse."
Rhombiverse's Rhombic Wheel (`src/app/rhombic-wheel-3d.js`/`-core.js`
there) is a mature, real THREE.js radial menu built on the RD mesh,
navigating between game "departments" (Build/Alter/Cultivate/Trade/
etc.). Polyhedraverse has no departments — its actual analogous problem
is the shape picker, which was a flat, ever-growing button row (29
entries already, heading toward 100+ as Johnson solids fill in). Scoped
by direct user choice to "wheel shell + shape picker" first, deferring
augment/diminish actions, Spherical/X-Ray view modes, and the small
corner HUD element Rhombiverse also has — see the roadmap memory for the
full deferred list.

**Shape**: a regular dodecahedron, not the icosahedron first proposed —
the user's own call ("may have less empty space"). Built directly from
this registry's own `POLYHEDRA.DODECAHEDRON` spec (vertices + faces
already unit-edge, already validated), not a second hand-declared shape —
same "derive, don't duplicate" rule every file in `app/lib/polyhedra/`
already follows.

**Color identity**: after initially porting Rhombiverse's exact colors
1:1 (cyan `#4DD0E1`, gold `#d4af37`), direct user follow-up asked for
Polyhedraverse's own identity instead: a metallic silver mesh
(`HUD_METAL_HEX = 0xc7ccd1`, metalness 0.7) for the wheel object itself,
green (`SCRIPT_COLOR = '#34D399'`, matching the app's existing
`emerald-500` Confirm-button accent) for labels and panel chrome. The
interaction *mechanics* — not colors — are still ported as exactly as
practical: reveal timing (350ms hover/hold-to-reveal text under a
resting symbol), the `rgba(2,2,6,0.55)` backdrop and
`rgba(10,12,20,0.85)` panel opacities, a 5px drag-vs-click threshold. The
future small corner HUD element is planned silver-with-black-script, not
gold, per the same follow-up direction.

**Deterministic navigation, not just free drag**: a dodecahedron has 12
faces spread all around a sphere, so whatever's front-facing when the
wheel opens is arbitrary. Free mouse-drag (via `OrbitControls`) is still
available, but arrow keys / on-screen ‹›▴▾ buttons step the camera by a
fixed azimuth/polar increment, re-derived from the camera's *current*
position each time (not separately tracked state, which could drift out
of sync with a free drag) — guarantees every face is reachable within a
bounded number of steps, which matters for real keyboard/accessibility
use as much as for automated testing.

**Two real bugs found via actual Playwright testing, not code review**:
1. Label/mesh click handlers originally called `onSelect()`
   synchronously inside the native `click` listener. Since `onSelect`
   triggers a React state update that immediately mutates the very label
   just clicked (its text changes as the newly-selected level's content
   gets applied), this raced against Playwright's own internal
   post-click verification — the click had already fired and taken
   effect, but `locator.click()` still reported a timeout because the
   DOM it was re-checking had changed out from under it mid-check. Real
   users would never notice (no external verification step), but it's a
   real hazard for anything else watching for a completed-click signal.
   Fixed by deferring `onSelect()` via `setTimeout(fn, 0)`.
2. Even after that fix, a *reported* click failure remained ambiguous —
   it could mean nothing happened, or it could mean the click worked and
   the searched-for label legitimately no longer exists because the
   wheel already moved on. `tests/e2e/utils.ts`'s `clickWheelLabel`
   resolves this by treating "the label is now gone entirely"
   (`locator.count() === 0`, checked fresh) as an alternate success
   signal, not just trusting the click promise's own pass/fail — found
   by watching a test reliably fail immediately after the app had
   visibly already navigated to the right screen in the failure
   screenshot, not by reasoning about the code in the abstract.

**Testability**: the wheel exposes `__pwGoTo(azimuthIndex, polarIndex)`
on its container (`data-testid="polyhedral-wheel-scene"`) for absolute,
deterministic camera repositioning — the same fundamental problem
`findOnCanvas()` already solves for WebGL vertex-picking, one level up,
for a second independent 3D scene. `resetTo()` and every spec that used
it (attach/delete/face-attach/persistence/render/rewrite) now drive the
wheel via a bounded ~24-orientation search (8 azimuth x 3 polar) with
paging support (`clickWheelLabelPaged`, for families that overflow 11
content faces — only Archimedean does today, at 13) — no changes needed
to the specs themselves beyond that one shared helper.
`render.spec.ts`'s "renders all shape buttons" test was rewritten to
open the wheel and check DOM existence of every registered shape across
all 4 families, paging as needed, since the flat button row it used to
check no longer exists.

Verified end to end: lint/tsc clean, full Playwright suite (14/14) on
both this machine and dicto-node.

Still outstanding: PolyhedralWheel's own deferred phases (augment/
diminish actions, Spherical/X-Ray view modes), re-matching face
connections on rewrite (the gap noted in the face-snap section above),
and an eventual introductory puzzle game (working name DELTIS), which
remains speculative — see vercel-deployment-plan.md and README.md. The
corner HUD element above is done, not deferred, as of the very next
section below.

## CornerHudWheel, face-attach filtering, and a real pagination bug (2026-09-08)

Direct follow-up requests after the wheel first shipped, all shipped
same session: a small always-visible corner medallion
(`app/components/CornerHudWheel.tsx`, top-right, matching Rhombiverse's
own `hud-wheel-3d.js` — solid opaque silver-grey with black relief edge
lines, rotates on drag only, no idle animation, clicking it opens the
full wheel); `PolyhedralWheel`'s new `filterIds` prop, wired into the
face-attach flow so picking a shape to attach via a selected free face
only shows shapes with a matching face size (dropped from view entirely,
not shown disabled) — replacing the old flat "Attach X via face"
per-shape button row.

**A real pagination bug, caught by a full-suite run, not inspection**:
the wheel's "More" face was shown whenever a family's *total* id count
overflowed a single page — on *every* page of that family, including the
last one, where clicking it wrapped `(page + 1) % totalPages` back to
page 0 instead of doing nothing. Combined with the click-ambiguity retry
`clickWheelLabel` already has (a click that looks like it failed but
actually worked), this could double-advance past a family's real last
page and silently skip whatever shapes lived there — caught when
`render.spec.ts`'s "renders every shape" test started intermittently
failing to find `TRUNCATED_ICOSAHEDRON`, the Archimedean family's own
13th shape, alone on its own second page. Reproduced twice before
trusting it was real, not a flake. Fixed by computing `hasMore`
per-page (`start + perPage < ids.length`) instead of reusing the
once-computed `overflow` flag.

Verified end to end: lint/tsc clean, full Playwright suite (15/15,
including a direct check that `filterIds` actually excludes DODECAHEDRON
from a 4-gon face-attach picker, not just fails to block CUBE) on both
this machine and dicto-node.

## Johnson solids — elongated/gyroelongated pyramids, cupolas, rotunda (2026-09-08)

13 more Johnson solids, bringing the family to 19/92: elongated pyramids
(J7-J9 — a matching prism inserted under the batch-1 pyramid cap),
gyroelongated pyramids (J10-J11, n=4,5 only — an antiprism instead of a
prism; n=3 doesn't exist as a distinct Johnson solid, since a triangular
antiprism is just an octahedron), elongated cupolas/rotunda (J18-J21 — a
prism inserted under the batch-1 cupola/rotunda's own larger face), and
gyroelongated cupolas/rotunda (J22-J25 — an antiprism instead).

Every shape is literal vertex construction on top of the already-
verified batch-1 pieces, using the same closed-form height formulas as
before — a uniform m-gon antiprism's height solves
`h^2 = 1 - 2*R_m^2*(1 - cos(pi/m))` (the same law-of-cosines derivation
family as the cupola height formula, just with equal top/bottom radii
instead of R_n vs R_2n).

**A real scale-mismatch bug, worth generalizing**: building J21/J25
(elongated/gyroelongated pentagonal rotunda) means appending a new ring
of points to J6's own vertex data — but J6's *raw, pre-`makeSpec`*
Python-side vertices carry whatever scale they were originally derived
at (half of `ICOSIDODECAHEDRON`'s own coordinates, edge length 1/φ ≈
0.618, not 1) — `makeSpec()`'s unit-edge normalization only happens once
the final literal arrays are loaded into the actual TypeScript registry;
the intermediate Python generation data is never re-normalized. The
first attempt at J21 produced a hull with two different edge lengths
(0.618 for J6's own original edges, 1.0 for the newly-appended ring,
which was built assuming unit length) — caught immediately by the same
edge-length-uniformity check every shape in this project goes through.
Fixed by explicitly measuring J6's actual raw edge length and rescaling
its vertices to exactly 1 before using them as a base for anything else.
**General rule this generalizes to**: never assume a previously-derived
shape's intermediate (pre-`makeSpec`) coordinates are already unit-edge
just because the final registry entry is — measure and rescale
explicitly before building on them, every time.

A second, smaller trap avoided (not hit, but worth recording): J6's
decagon face isn't axis-aligned the way a freshly-parameterized
cupola/pyramid's base ring would be — it's the equatorial cross-section
of the icosidodecahedron it was sliced from, at whatever orientation
that hull happened to produce. Identifying "the bottom decagon" via
J6's own verified `faces` array (the one 10-sided face) and computing
its real outward normal (confirmed by checking which side every other
vertex falls on, not assumed) — rather than sorting vertices by a
z-coordinate that has no reason to mean anything for this particular
shape — is what made the ring-insertion and rotation-about-that-normal
(via Rodrigues' rotation formula, for the gyroelongated case) come out
correct on the first geometry attempt.

`J10_GYROELONGATED_SQUARE_PYRAMID` is the first shape in the registry
with no degree-3 vertex at all (only degree 4 and degree 5) — every
prior shape had at least some. `tests/e2e/render.spec.ts` gained a
real-browser check that both degrees render/hover correctly, confirming
nothing in that path silently assumed a degree-3 vertex exists somewhere.

All 13 shapes verified against a real convex hull (V/E/F derived from
Euler's formula plus each shape's own known face composition, independently
worked out per shape rather than recalled from memory alone, then
cross-checked against the hull's actual output) and matched on the first
attempt once the J6 rescale above was fixed.

Verified end to end: `validate-johnson.ts` (all 19 OK), lint/tsc clean,
`verify:attach` (39,522), `verify:twist` (31,752), `verify:rewrite`,
`verify:graph`, `verify:face-connectors` (2,652 — new 4-gon/6-gon/8-gon/
10-gon compatibility groups spanning the new elongated/gyroelongated
shapes), `verify:face-attach` (279,530, 0 failures on the first run),
`verify:face-twist` (3,394), and the full Playwright suite (16/16,
including the new no-degree-3-vertex check), on both this machine and
dicto-node.

## Johnson solids — bicupolae and cupola-rotunda compounds (2026-09-08)

8 more Johnson solids, bringing the family to 27/92: bicupolae (J27
triangular-ortho, J28/J29 square-ortho/gyro, J30/J31 pentagonal-ortho/
gyro), cupola-rotunda compounds (J32/J33 pentagonal-ortho/gyro), and a
birotunda (J34 pentagonal-ortho). Each is two batch-1 pieces joined at
their matching largest face (a 2n-gon, or a decagon for anything
involving J6's rotunda), either aligned ("ortho") or twisted by the
joined polygon's own half-sector before joining ("gyro").

**The ortho/gyro offset (0 or pi/n) was verified empirically, not
assumed** — a real, useful check that caught a genuine degeneracy: for
n=3, the two offsets produce different point sets, but only offset=0 is
a distinct Johnson solid. Offset=pi/n's pairwise-distance histogram (a
rotation-invariant fingerprint — if two point sets have the exact same
multiset of all pairwise distances, they're congruent) matches this
registry's own `CUBOCTAHEDRON` exactly, confirming the well-known fact
that "triangular gyrobicupola" isn't counted as a separate Johnson
solid because it coincides with an Archimedean one already in this
registry. That same offset formula was then trusted for n=4 and n=5,
where both ortho and gyro genuinely are distinct, real Johnson solids —
verified the same way (checking they're valid, uniform-edge convex
hulls with matching V/E/F), not just assumed to work because n=3 did.

**J6 needed re-orienting before it could compose with anything else**:
its own raw vertex data has its decagon face at an arbitrary
orientation (the equatorial cross-section plane of the icosidodecahedron
it was sliced from in batch 1 — see that section above), so it was
rotated (found via its own `faces` array, not assumed by coordinate
position) so the decagon sits in the z=0 plane using the exact same
angular convention `cupola()` already uses for its own base ring —
confirmed to preserve J6's own V/E/F and edge uniformity before trusting
it as a building block for J32/J33/J34.

**A real solid was built, checked, and deliberately left out**: a
"pentagonal gyrobirotunda" (two J6 copies joined at their decagon with a
gyro twist) computes as a genuine, distinct, valid convex uniform-edge
polyhedron (V=30 E=60 F=32, 20 triangles + 12 pentagons — confirmed via
its own pairwise-distance histogram to be neither the ortho birotunda
nor the icosidodecahedron already in this registry) — but there's no
confident basis for whether that specific combinatorial gluing
corresponds to a genuinely named entry in the standard 92 Johnson
solids, the way "pentagonal orthobirotunda" (J34) does. Rather than
assert an uncertain classification, it's left out of this batch
entirely. Worth recording as a distinct case from this project's usual
"verify before shipping" postmortems: not catching a wrong
construction, but declining to claim a right one without confidence —
the same standard applied in the other direction.

Verified end to end: `validate-johnson.ts` (all 27 OK), lint/tsc clean,
`verify:attach` (55,250), `verify:twist` (45,000), `verify:rewrite`,
`verify:graph`, `verify:face-connectors` (3,200), `verify:face-attach`
(409,554, 0 failures on the first run), `verify:face-twist` (4,770), and
the full Playwright suite (16/16) on both this machine and dicto-node.

Still outstanding for Johnson solids at this point: 65 remain (92 - 27)
— the remaining augmented/diminished/gyrate composites next (including
resolving whether "pentagonal gyrobirotunda" above is real and just
needs a name, or genuinely isn't part of the 92), then the ~15 with no
closed form at all (genuine numerical optimization needed), saved for
last.

## Johnson solids — elongated bipyramids and the gyrobifastigium (2026-09-08)

4 more Johnson solids, bringing the family to 31/92: J14/J15/J16
(elongated triangular/square/pentagonal bipyramid) and J26
(gyrobifastigium). These fill a numbering gap deliberately skipped by
the first three batches — J1-J11/J18-J25 covered pyramids and cupolas
(not bipyramids), and J27-J34 covered bicupola/cupola-rotunda compounds
(also not bipyramids). J12/J13/J17 (the plain, non-elongated bipyramids)
are already in the registry as deltahedra D6/D10/D16 and were never
re-derived, which is why this specific trio of *elongated* bipyramids
had been left for later rather than being bundled into batch 2's
elongation work.

**Elongated bipyramids (J14-J16)**: an n-gon prism (bottom ring z=0, top
ring z=1, no twist between them) capped with a pyramid apex above and
below, using the exact same closed-form apex-height equation as J1/J2:
`h = sqrt(1 - R_n^2)`. This only has a real solution for n=3/4/5 — n=6
would need R_6=1 exactly, giving h=0 (a degenerate flat "apex" coplanar
with the hexagon), which is the actual reason there's no hexagonal
bipyramid Johnson solid: at n=6 the two apexes collapse into the ring
itself instead of forming genuine triangular faces.

**Gyrobifastigium (J26)**: two unit triangular prisms (equilateral
triangle cross-section, extrusion length 1 — with those proportions all
3 lateral faces are already unit squares, not just the 2 triangular
ends) glued together at one shared square face, with the second prism
rotated 90° relative to the first before gluing. The *ortho* pairing
(gluing unrotated) was checked too, via the same convex-hull method —
and it's not a second valid Johnson solid at all, for a more interesting
reason than "not distinct": unrotated, each pair of prism end-triangles
becomes coplanar across the join, so the hull merges each pair into one
rhombic face (two unit equilateral triangles sharing an edge at 60°/120°,
side 1 but with unequal diagonals 1 and √3) — a genuine rhombus, not a
square, and therefore not a regular polygon at all. That disqualifies
the ortho pairing outright rather than merely making it a duplicate of
something else, which is the real reason only the gyro (90°) form is
one of the 92.

**Derivation method changed for this batch**: rather than hand-declaring
face windings (as batches 1-3 did, building on `cupola()`/pyramid-apex
helpers with manually-ordered face-vertex lists), this batch computed
faces directly from a real `scipy.spatial.ConvexHull` on each shape's
raw vertex set — the hull's per-triangle facets were grouped by
(rounded) plane equation, merged into their true n-gon faces, and
ordered by angle around each face's own outward normal. This is a
strictly more automated cross-check than prior batches' "derive
verts+edges, hand-list faces, then verify with a hull" approach: here
the hull *is* the face list, so there's no possibility of a
hand-transcription face-winding bug slipping past validation — the
faces are exactly what the hull says they are, with edge-length
uniformity, V/E/F counts, face-size-mix, and Euler's formula still
checked afterward as before.

Verified end to end: `validate-johnson.ts` (all 31 OK), `tsc --noEmit`
and lint clean (both machines), `verify:attach` (61,722),
`verify:twist` (52,488), `verify:rewrite`, `verify:graph`,
`verify:face-connectors` (3,336), `verify:face-attach` (450,770, 0
failures), `verify:face-twist` (5,754), and the full Playwright suite
on dicto-node.

**A real, pre-existing test-infrastructure bug surfaced and fixed along
the way, unrelated to any of the 4 new shapes**: `render.spec.ts`'s
full-registry test started failing intermittently (~40% of runs) with
"Johnson family should list J3_TRIANGULAR_CUPOLA" once the family grew
to 31 ids (3 pages of the wheel instead of fitting differently) — but
J3 is nowhere near a page boundary (index 14 of 31, squarely on page 2
of 3). Instrumenting the actual click handlers (not guessing) showed
the real cause: `tests/e2e/utils.ts`'s `clickWheelLabel` treats "the
target locator is gone" as proof a click already succeeded, to resolve
a known race where Playwright's own post-click actionability check can
throw even though the click already fired and had its real effect (the
label's onSelect is deferred via `setTimeout(0)`, so the DOM mutation
can land just after Playwright gives up waiting for it). That heuristic
is correct for a one-off shape label, which genuinely disappears once
selected — but "More" reappears identically labeled on the very next
page, so "is this locator gone" never fires true for it. A single
logical `clickWheelLabel(page, 'More')` call would hit the ambiguous-
failure path, wrongly conclude the first (actually-successful) click
had failed, and issue a real second click — silently double-advancing
the wheel from page 0 straight to page 2, skipping page 1 (and
everything on it, including J3) entirely. This wasn't new to batch 4 —
the Johnson family already needed 3 pages before this batch too — it
was latent and apparently never triggered before purely by luck of
timing; adding this batch's 4 shapes didn't cause it, just happened to
be the run where it got noticed. Fixed by replacing the "is *this*
locator gone" check with "has the *entire* label-text snapshot changed
at all", which correctly resolves the same ambiguity without the false
negative — verified by running the affected test 5 additional times
after the fix (0 failures) versus reproducing the original failure 2 of
3 times immediately beforehand with the exact same code otherwise.
`render.spec.ts` also gained a `stableLabelTexts` helper (poll until
two reads 80ms apart agree) as defense in depth against the underlying
`setTimeout(0)`-deferred-render race generally, independent of this
specific fix.

Still outstanding for Johnson solids at this point: 61 remain (92 - 31)
— the augmented/diminished/gyrate composites (J49 onward) and the
elongated/gyroelongated bicupola/cupola-rotunda/birotunda family
(J35-J48, the direct sequel to batch 3 the same way batch 2 followed
batch 1) are next, then the ~15 with no closed form at all, saved for
last.

## Johnson solids — elongated/gyroelongated bicupolae, cupola-rotundas, birotundas (2026-09-08)

14 more Johnson solids, bringing the family to 45/92: J35-J43
(elongated, prism spacer) and J44-J48 (gyroelongated, antiprism
spacer) — the direct sequel to batch 3, applying batch 2's spacer
technique to batch 3's own cupola/rotunda pieces instead of re-deriving
anything from first principles.

**Construction changed again for this batch**: each piece (a single
cupola's cap+waist, or a rotunda "half" sliced out of the
already-verified `J32`/`J34`) was extracted directly from this
registry's own verified vertex data via a small `tsx` dump script, not
re-derived from formulas, then rejoined either directly (as a
self-check) or through a prism/antiprism spacer. Two real bugs were
caught by that self-check — reproduce J27-J34 exactly from the
extracted primitives before trusting the same machinery for anything
new — before any new shape was accepted:

1. **"Gyro" rotates only the cap, not the waist.** An initial attempt
   rotated the whole piece (cap + waist ring together) by a half waist-
   ring step to get the gyro offset; this moves the waist ring to new
   positions instead of relabeling the same one, silently breaking the
   shared-face requirement the whole join depends on. The fix: only the
   cap rotates, by one *full* waist-ring step (`2*pi/waist_size`) — the
   waist ring itself must stay exactly where it is, since it's the
   shared face; "ortho" vs "gyro" is which notch of that fixed ring the
   cap sits above, not a rotation of the ring itself.
2. **Cross-type pieces need a common source.** A cupola piece and a
   rotunda piece pulled from *independent* origins (a standalone cupola
   plus a rotunda sliced out of the orthobirotunda) aren't guaranteed to
   share a rotational registration — nothing forces their waist rings'
   vertex 0 to point the same direction. The fix: extract both halves of
   any cupola+rotunda pairing from the *same* already-verified compound
   (`J32`/`J33`), which guarantees correct alignment by construction
   rather than by hoping two independently-built rings happen to line
   up.

**A third bug surfaced only after both of the above were fixed and the
self-check passed** — a genuinely more subtle one, worth recording in
full because it slipped past the self-check entirely: `verify:face-attach`
and `verify:face-twist` (which check the *cross-shape* face-attach
transform math, not anything about an individual shape's own internal
consistency) failed on roughly 12% and 7% of their checks respectively,
with "coincidence error" values around 1e-6 to 1e-7 — 1,000x the
scripts' own 1e-9 tolerance. The self-check hadn't caught it because
Euler's formula, edge-length uniformity, and face composition are all
blind to a *uniform* absolute-position offset — exactly what this was.
Root cause: the piece-extraction helper rounded each vertex's z-
coordinate to 6 decimals *for grouping purposes* (to sidestep floating-
point-equality issues when picking out "the waist ring" via
`np.isclose`), but then reused that same rounded value as the literal
amount to shift the piece by, instead of the true (unrounded) z of the
selected waist vertices. That leaked up to ~5e-7 of pure rounding noise
into every single vertex as a uniform offset on otherwise-correct
geometry — large enough to fail a strict 1e-9 cross-shape tolerance
against other registry shapes, but invisible to any single-shape
validity check. Fixed by computing the shift from the *actual* selected
vertices' mean z (unrounded) rather than the rounded comparison value;
re-ran `verify:face-attach` (968,713 checks) and `verify:face-twist`
(9,670 checks) after the fix — 0 failures, down from ~113k and ~660.
**General rule, adding to this project's running list**: a rounding
step introduced purely to make an equality comparison numerically safe
must never be reused as an actual computed value elsewhere in the same
function — round only the copy used for comparison, keep the original
for any arithmetic.

Distinctness was also verified computationally, not assumed: two of the
14 (`J36`, `J43`) are built from an ortho/gyro cupola or rotunda pairing
that *isn't itself* a registered Johnson solid (their un-elongated forms
either coincide with the cuboctahedron or are the deliberately-excluded
"pentagonal gyrobirotunda" from batch 3) — a rotation-invariant
pairwise-distance-histogram cross-check confirmed all 14 new shapes are
mutually distinct and distinct from every one of the other ~50 shapes
already in the registry. That elongating breaks both of batch 3's
coincidences (the excluded gyro-cuboctahedron overlap and the
unconfirmed gyrobirotunda) is the expected, structural reason these
elongated forms are safe to register even though their un-elongated
bases weren't: real height between the two halves removes any way for
the result to degenerate into something else.

Verified end to end: `validate-johnson.ts` (all 45 OK), `tsc --noEmit`
and lint clean on both machines, `verify:attach` (106,080),
`verify:twist` (83,232), `verify:rewrite`, `verify:graph`,
`verify:face-connectors` (4,817), `verify:face-attach` (968,713, 0
failures after the precision fix), `verify:face-twist` (9,670, 0
failures after the precision fix), and the full Playwright suite on
dicto-node.

Still outstanding for Johnson solids at this point: 47 remain (92 - 45)
— the augmented/diminished/gyrate composites (J49 onward, roughly two
dozen shapes touching prisms and the dodecahedron/
rhombicosidodecahedron) next, then the ~15 with no closed form at all
(genuine numerical optimization needed), saved for last.

## Johnson solids — augmented prisms (2026-09-08)

8 more Johnson solids, bringing the family to 53/92: augmented (J49),
biaugmented (J50), and — skipping J51, see below — augmented (J52),
biaugmented (J53) pentagonal prism, and augmented (J54),
parabiaugmented (J55), metabiaugmented (J56), and triaugmented (J57)
hexagonal prism. Each is a unit-edge n-gon prism (bottom/top rings,
unit height so the side faces are already unit squares — the same
construction J7-J9/J14-J16 already use) with a square pyramid (apex
height `sqrt(1 - R_4^2)`, J1's own closed-form height) glued onto one
or more of its side squares.

**J51 (triaugmented triangular prism) is deliberately excluded — and
verified, not just recalled, to already be `D14`.** Augmenting all 3 of
a triangular prism's side squares was run anyway as a pure self-check
before trusting the construction method for the other 8: its pairwise-
distance histogram matches this registry's own `D14` (a deltahedron
from a much earlier, unrelated batch) vertex for vertex. This is the
strongest confidence signal available for a new construction method —
not just internally consistent (Euler, edge length, no swallowed
vertices) but independently corroborated against a shape this registry
already trusted for a different reason entirely.

**Which square faces get augmented, and why some combinations aren't
separately named, follows directly from each prism's own symmetry**: a
triangular prism's 3 side squares are mutually equivalent, so
"biaugmented" (J50) has only one distinct configuration. A pentagonal
prism's 5 side squares form a single 5-cycle with no notion of two
faces being directly "opposite", so — unlike the hexagonal case —
there's no separately-named "parabiaugmented pentagonal prism": J53's
"2 non-adjacent" is the only distinct choice. A hexagonal prism's 6
side squares DO have a real para/meta distinction (opposite vs.
separated-by-one), which is exactly why J55/J56 are separately named
and turn out geometrically distinct despite an identical face-size
mix — confirmed via a pairwise-distance-histogram check, not assumed
from the different name alone. Triaugmented (J57) uses the 3 mutually-
alternating squares, the only symmetric way to pick 3 of 6 with no two
adjacent.

Faces again come from a real `scipy.spatial.ConvexHull` (batches 4-5's
method), which doubles as an automatic correctness check specific to
augmentation: if a pyramid apex were placed too shallow to actually
protrude past the prism's own convex hull, the hull would silently
swallow it back into a flat face instead of a genuine augmentation —
every one of the 9 constructions here (8 registered plus the D14
self-check) was confirmed to keep the apex as a real, separate hull
vertex.

**A user-asked side investigation, resolved computationally rather than
from memory**: are any registered Johnson solids chiral, and could that
matter for face-attach? Checked by testing whether each shape can be
superimposed on its own mirror image via any rotation (reflecting
through 360 candidate vertical planes at half-degree steps and looking
for a point-for-point match) — confirmed genuinely chiral: J44-J48
(batch 5's gyroelongated bicupola/cupolarotunda/birotunda family) and
the two already-registered snub Archimedean solids (`SNUB_CUBE`,
`SNUB_DODECAHEDRON`). Only one handedness of each is stored, which
matches standard convention (a chiral solid and its mirror share one
name/count in the official 92 or in the Archimedean 13), but a mirror-
image toggle for face-attach involving a chiral piece is a real,
legitimate gap this surfaced — not yet scoped or built, recorded for a
future session.

Verified end to end: `validate-johnson.ts` (all 53 OK), `tsc --noEmit`
and lint clean, `verify:attach` (125,704), `verify:twist` (103,968),
`verify:rewrite`, `verify:graph`, `verify:face-connectors` (5,119),
`verify:face-attach` (1,101,537, 0 failures), `verify:face-twist`
(12,550, 0 failures), and the full Playwright suite on dicto-node.

Still outstanding for Johnson solids at this point: 39 remain (92 - 53)
— augmented dodecahedra (J58-J61), diminished/augmented icosahedra
(J62-J64), augmented truncated Archimedean solids (J65-J71), and
gyrate/diminished rhombicosidodecahedra (J72-J83) next (roughly two
dozen shapes), then the ~15 with no closed form at all, saved for last.

## Johnson solids — augmented dodecahedra, bidiminished/tridiminished icosahedra (2026-09-08)

6 more Johnson solids, bringing the family to 59/92: augmented (J58),
parabiaugmented (J59), metabiaugmented (J60), and triaugmented (J61)
dodecahedron; metabidiminished (J62) and tridiminished (J63)
icosahedron.

**Augmented dodecahedra**: a pentagonal pyramid (J2's own closed-form
apex height) glued onto one or more of the dodecahedron's 12 pentagonal
faces. Which combinations are separately named comes directly from the
registry's own `DODECAHEDRON` face data via centroid-angle
classification, not assumed: each face has 5 adjacent faces (63.4°), 5
"meta" faces (116.6°), and exactly 1 "para" (opposite, 180°) face.
J59/J60 augment a para/meta pair respectively; J61 augments 3 mutually-
meta faces (found by searching for face triples where all 3 pairwise
angles equal the meta value — confirming genuine 3-fold symmetry rather
than an arbitrary choice).

**Diminished icosahedra — and a real subtlety about which vertex
removals are even valid, found by testing rather than assuming**:
"diminishing" an icosahedron vertex removes it and its 5 surrounding
triangles, leaving a regular pentagon (the convex hull of its 5
neighbors, coplanar by symmetry). Diminishing exactly ONE vertex gives
exactly J11 (gyroelongated pentagonal pyramid) — not a new Johnson
solid, which is why this family starts at J62 (2 removed). Verified via
self-check before trusting the method for anything new: removing 1
vertex from this registry's own `D20` (icosahedron) matches the
registered `J11` exactly, vertex for vertex.

Checked computationally, not assumed, which vertex-pair relationships
even produce a valid result: removing two ADJACENT vertices produces
overlapping pentagon-holes that merge into non-regular quadrilateral
faces (correctly rejected). Removing two ANTIPODAL vertices DOES
produce a valid, uniform-edge, all-triangle/pentagon convex shape — but
a pairwise-distance-histogram check shows it's a genuinely different
(non-congruent) solid from the two-meta-vertex removal, and only the
meta version is one of the 92 ("metabidiminished" — the name itself
says which). For J63 (tridiminished), a brute-force check of all 220
possible vertex triples confirmed the 3-mutually-meta configuration is
the *only* one producing a valid result — not assumed from the
2-vertex pattern.

**J64 (augmented tridiminished icosahedron) was investigated and
deliberately left out of this batch** — a direct continuation of this
project's standing precedent from batch 3's excluded gyrobirotunda.
Augmenting any one of J63's 3 pentagon faces with a matching pentagonal
pyramid was tried, and its apex lands EXACTLY on the position of the
icosahedron vertex that pentagon's diminishing had removed (confirmed
to zero within floating-point precision). This is mathematically
forced, not a bug: a regular unit-edge pentagon has a unique matching
pyramid apex position regardless of surrounding context. The resulting
shape is then provably congruent to J62 (same histogram check) — which
can't be the intended, separately-counted J64. Whatever J64 actually
is, it isn't "diminish 3 mutually-meta vertices, then re-augment one
pentagon." Rather than guess at a different construction without a
confident basis, it's left out entirely: the same standard as batch 3's
exclusion — declining to claim a right construction without confidence,
not just catching a wrong one.

Verified end to end: `validate-johnson.ts` (all 59 OK), `tsc --noEmit`
and lint clean, `verify:attach` (144,402), `verify:twist` (121,032),
`verify:rewrite`, `verify:graph`, `verify:face-connectors` (5,425),
`verify:face-attach` (1,224,187, 0 failures), `verify:face-twist`
(14,962, 0 failures), and the full Playwright suite on dicto-node.

Still outstanding for Johnson solids at this point: 33 remain (92 - 59)
— J64's status stays genuinely unresolved (see above); augmented
truncated Archimedean solids (J65-J71) next, then gyrate/diminished
rhombicosidodecahedra (J72-J83), then the ~15 with no closed form at
all, saved for last.

## Johnson solids — augmented truncated tetrahedron, and a real construction dead end (2026-09-08)

1 more Johnson solid, bringing the family to 60/92: augmented truncated
tetrahedron (J65) — a triangular cupola (J3) glued onto one of the
truncated tetrahedron's 4 hexagonal faces, the cupola cap built fresh
from the target face's own actual vertices (measured base ring,
centroid, and outward normal, cap placed at the closed-form cupola
height above the angular midpoint of each base edge) rather than
grafted from a separately-built piece — guaranteeing correct rotational
registration by construction, applying batch 5's cross-registration
lesson proactively instead of after the fact.

**J66-J71 were attempted with the identical method and appeared to pass
every check this registry had used up to this point — and were still
wrong.** Augmented (J66) and biaugmented (J67) truncated cube (square
cupola on one/two octagons), and augmented/parabiaugmented/
metabiaugmented/triaugmented truncated dodecahedron (J68-J71,
pentagonal cupola on one to three decagons) all passed Euler's formula
and uniform-edge-length checks — the same two checks that had caught
every real construction bug in batches 1-7. All six were initially
accepted. Only `verify:face-attach`/`verify:face-twist`'s strict
cross-shape tolerance caught the actual problem, on J67 and J69's
"extra" quadrilateral faces (formed where a cupola's own lateral
triangle happens to be exactly coplanar with an adjacent pre-existing
triangle of the truncated solid, and the convex hull correctly merges
the pair into one face). Direct measurement — comparing each
quadrilateral's two diagonals, not just its four edges — showed these
merged faces are **rhombi with unit edges but unequal diagonals**
(sqrt(3) and 1, not sqrt(2) and sqrt(2) the way a real square's
diagonals must match): visually and dimensionally close to a square,
but not a regular polygon, which disqualifies the whole shape from
being a Johnson solid no matter how uniform its edges are. Checking all
six systematically: J66 has 4 rhombi among 9 quads, J67 has 8 among 18,
J68 has 5 among 10, J69 has 10 among 30 — J65 (the one shape kept) has
zero. Whatever makes the truncated-cube/dodecahedron cases
geometrically different from the truncated-tetrahedron case isn't
understood well enough yet to fix with confidence, so J66-J71 are left
out of this batch entirely — the same standard as batch 3's excluded
gyrobirotunda and batch 7's excluded J64, applied here to six shapes
at once rather than one.

**The general lesson is worth stating plainly, since it could recur in
any future batch that involves face-merging**: edge-length uniformity
is necessary but not sufficient to confirm a face is a regular polygon
— a rhombus, a kite, and a square can all have four unit edges. This
registry's own `validateShape()` (in `core.ts`) only checks edge
lengths and V/E/F counts, by design (it's meant to be fast and
family-agnostic) — it is *not* a substitute for the slower, genuinely
authoritative `verify:face-attach`/`verify:face-twist` cross-shape
checks, which is exactly why those two scripts are run as a required
step for every batch, not an optional extra. This batch is the first
time that distinction actually mattered: every prior batch's
self-checks and the full verify suite agreed, so it was easy to treat
them as interchangeable. They are not. Any future "these two faces
merged into one, and that's fine" claim in this codebase needs a
diagonal or interior-angle measurement before being trusted, not just
an edge-length check.

Verified end to end: `validate-johnson.ts` (all 60 OK), `tsc --noEmit`
and lint clean, `verify:attach` (147,408), `verify:twist` (124,002),
`verify:rewrite`, `verify:graph`, `verify:face-connectors` (5,468),
`verify:face-attach` (1,243,089, 0 failures after removing J66-J71),
`verify:face-twist` (15,385, 0 failures after removing J66-J71), and
the full Playwright suite on dicto-node.

Still outstanding for Johnson solids at this point: 32 remain (92 - 60)
— J66-J71 and J64 all stay genuinely unresolved (documented above and
in the prior section, not silently missing); the augmented truncated
cube/dodecahedron rhombus problem is worth a dedicated investigation
before the next attempt, rather than retrying the same construction.
Gyrate/diminished rhombicosidodecahedra (J72-J83) are next in priority
order regardless, then the ~15 with no closed form at all, saved for
last.

## Johnson solids — gyrate/diminished rhombicosidodecahedra (2026-09-08)

11 more Johnson solids, bringing the family to 71/92: gyrate (J72),
parabigyrate (J73), metabigyrate (J74), trigyrate (J75), diminished
(J76), paragyrate diminished (J77), metagyrate diminished (J78),
parabidiminished (J80), metabidiminished (J81), gyrate bidiminished
(J82), and tridiminished (J83) rhombicosidodecahedron.

**Structural insight, verified rather than assumed**: the
rhombicosidodecahedron (RD) decomposes into 12 local "pentagonal
cupola" regions — one per pentagon face, each surrounded by 5 triangles
alternating with 5 squares, matching J5's own band structure exactly —
extracted directly from RD's own registered face/edge data (which
vertices form each pentagon's 10-vertex "waist" ring), not assumed from
the shape's name or general description. Two operations, applied to
one or more regions independently while everything else in RD stays
completely fixed:
- **gyrate**: rotate one region's pentagon cap by one waist-ring step
  (36°) relative to its own decagon waist — the gyrated position is
  simply the other 5 of the waist decagon's 10 edge-midpoints, the same
  "cap sits at the angular midpoint of alternating base edges"
  principle every cupola construction has used since batch 1.
- **diminish**: remove one region's 5 pentagon-cap vertices entirely,
  exposing its waist decagon as a real face once the convex hull
  recomputes without the cap.

Which regions can be combined, and what the combination is named, reuse
the exact same face-centroid-angle classification (adjacent/meta/para)
already proven correct for the dodecahedron in batch 7 — RD's 12
pentagons correspond directly to the dodecahedron's 12 faces, confirmed
to have the identical angle classes (63.4°/116.6°/180°) before reusing
that classification rather than assuming it transfers.

**Batch 8's lesson was applied proactively this time, not after the
fact**: every quad face of every candidate was checked by diagonal
measurement (a true square has equal diagonals of sqrt(2); a rhombus
with the same unit edges does not) from the start, alongside the usual
edge-length/Euler checks. All 11 accepted shapes passed with zero
non-square quads — the discipline learned in batch 8 held up under a
much larger, more combinatorially complex family on the first attempt.

**J79 (bigyrate diminished) was attempted and left out.** Gyrating both
regions of a para pair (reproducing J73's own already-verified
construction) and then diminishing a third region failed with a large,
consistent edge-length error — tried against all 10 possible
third-region choices (every region other than the two already
gyrated), all failing identically with the same error magnitude. Since
every choice fails the same way, this isn't a matter of picking the
wrong region; something about combining two simultaneous gyrations with
a further diminish isn't understood well enough yet to construct with
confidence. Left out rather than forced, the same standard as batch 3's
gyrobirotunda, batch 7's J64, and batch 8's J66-J71.

Verified end to end: `validate-johnson.ts` (all 71 OK), `tsc --noEmit`
and lint clean, `verify:attach` (223,344), `verify:twist` (159,048),
`verify:rewrite`, `verify:graph`, `verify:face-connectors` (7,165),
`verify:face-attach` (1,977,613, 0 failures), `verify:face-twist`
(19,153, 0 failures), and the full Playwright suite on dicto-node.

Still outstanding for Johnson solids: 21 remain (92 - 71) — J64, J66-
J71, and J79 all stay genuinely unresolved (documented above, not
silently missing); the remaining shapes are the ~15-21 with no closed
form at all, requiring genuine numerical optimization rather than the
closed-form constructions used for every batch so far, saved for last
as originally planned.

## Batch 10 (2026-09-09) — correcting all 6 of batch 8's excluded J66-J71

Before this batch, `docs/johnson-solids-remaining-spec.md` was written
to scope alternative construction protocols for all 21 remaining
Johnson solids, using external research (not guessed) to find concrete
corrections rather than re-attempting the same failed constructions.
For J66-J71, that research found the missing detail directly: the
square/pentagonal cupola cap must land in the ONE discrete rotational
registration where its own square lateral faces sit next to the
truncated solid's TRIANGLES, not its own larger polygon faces —
batch 8's attempt used `computeFaceAttach`'s default "no extra twist"
registration, which is only correct for HALF of a face's possible
registrations and happened to land on the wrong half.

**Verified directly, not assumed**: rather than trust the research and
retry once, every possible registration (8 for an octagon-capped face,
10 for a decagon-capped one) was built and diagonal-checked
independently. The result was a clean, total split: exactly half the
registrations (the odd offsets under this project's own
`faceRotationalSymmetry`/`computeFaceAttach` indexing) reproduce a
true 12-triangle/5-square/5-octagon (or 25-triangle/5-square/1-pentagon
/11-decagon) result with zero non-square quads; the other half
reproduce batch 8's exact rhombus-contamination bug. This directly
confirms the hypothesis rather than merely working around it — batch
8's failure really was a wrong registration, not a deeper flaw in the
construction method.

**J66 (augmented truncated cube)** and **J68 (augmented truncated
dodecahedron)**: single cupola cap each, corrected registration found
by sweeping all candidates for that specific face. **J67 (biaugmented
truncated cube)**: two square cupolas on the truncated cube's OPPOSITE
octagon pair (confirmed externally, not guessed to be adjacent or
opposite) — each cap's correct registration was verified in ISOLATION
first (both happened to need the same parity, checked rather than
assumed, since two different faces of the same solid could in
principle need different registrations depending on that face's own
vertex-0 phase — the same hazard class as the Catalan-solids
face-vertex-0 bug) before combining into the final double-augmented
shape.

**J69/J70 (parabiaugmented/metabiaugmented truncated dodecahedron)**:
two pentagonal cupolas each, on the "para" (opposite, dot≈-1) and
"meta" (dot≈-0.4472) decagon pairs respectively — confirmed the
truncated dodecahedron's 12 decagons carry EXACTLY the dodecahedron's
own adjacent/meta/para face-angle classification from batch 7/9 (same
3 angle classes, cos 0.4472/-0.4472/-1), not assumed to transfer.
Directly confirmed J70 is NOT congruent to J69 via the same
rotation-invariant pairwise-distance-histogram check from batch 3 (max
diff 0.244, nowhere near what a true duplicate would show), despite
both sharing identical V/E/F/face-composition. **J71 (triaugmented)**:
three pentagonal cupolas on a mutually-meta triple (all 3 pairwise dot
products ≈-0.4472, matching batch 7's "3-mutually-meta is the only
configuration that works" precedent for the plain dodecahedron's own
triaugmentation; 20 such triples exist by symmetry, any one works).
**A real, previously-only-hypothesized wrinkle surfaced here**: J71's 3
target faces did NOT all need the same registration parity — 1 needed
odd k, the other 2 needed even k, confirmed by checking each face
completely independently rather than assuming J67's "they happened to
match" result would generalize. Exactly the hazard flagged in J67's
own doc comment, now actually observed — a good reminder that
"verify every face independently" is a real requirement, not excess
caution.

All 6 of batch 8's excluded shapes are now correctly built: J66-J71
complete this Johnson-solids group entirely.

**J64 also corrected in the same batch** (Group 2 of the spec doc,
completing batch 7's own unfinished business): external research found
batch 7's attempt used entirely the wrong operation — augmenting one
of J63's PENTAGON faces with a pentagonal pyramid, when the actual
construction attaches a regular TETRAHEDRON to the one specific
TRIANGULAR face of J63 that's edge-adjacent to all 3 of its pentagons.
That face was found combinatorially from J63's own registered data
(checking each of its 5 triangles against all 3 pentagons for a shared
edge — exactly one, `[0,1,5]`, qualifies), and attaching `D4` (the
tetrahedron already in this registry) via the standard face-attach
transform produced a clean result immediately, with no coplanar-merge
ambiguity the way J66-J71 had. Directly confirmed NOT congruent to J62
via the same pairwise-distance-histogram check that first caught batch
7's mistake (max diff 0.618) — genuinely the different shape this
time, not a coincidental near-miss.

Verified end to end: `validate-johnson.ts` (all 78 OK), `tsc --noEmit`
and lint clean, `verify:attach` (347,022), `verify:twist` (246,402),
`verify:rewrite`, `verify:graph`, `verify:face-connectors` (8,646),
`verify:face-attach` (2,810,143, 0 failures), `verify:face-twist`
(22,326, 0 failures), and the full Playwright suite on dicto-node.

Still outstanding for Johnson solids: 14 remain (92 - 78) — J79 stays
genuinely unresolved (documented above and in
`docs/johnson-solids-remaining-spec.md`'s Group 3); the remaining ~13
shapes have no closed form at all, requiring genuine numerical
optimization rather than the closed-form/registration-sweep
constructions used for every batch so far, saved for last as
originally planned.

## Batch 11 (2026-09-09) — J79, correcting batch 9's one excluded shape

The original batch-9 derivation script wasn't kept (this project's own
convention: derive offline, transcribe only the final result) so J79
was rebuilt from scratch, with the RD-region gyrate/diminish machinery
INDEPENDENTLY self-checked against every already-verified
single-operation shape already in the registry before attempting J79
itself, the same discipline batch 5 used reproducing all 8 of batch 3's
compounds before trusting a new construction: gyrating one region
exactly reproduced J72 (unordered point-set match, 0.000000 error);
gyrating two regions simultaneously exactly reproduced J73 (5e-13,
floating-point noise); diminishing one region exactly reproduced J76
(confirmed via a rotation-invariant pairwise-distance-histogram, since
J76's own stored orientation turned out to differ from RD's — an
arbitrary choice from whichever batch built it, not a bug).

**The actual root cause of batch 9's failure, found here**: batch 9
assumed J79's two gyrated regions were RD's "para" (opposite, 180°)
pair, reasoning it should reproduce J73's own already-verified
construction — and this doc's own earlier scoping pass (batch 10)
read the external research the same way, taking "two non-adjacent
cupolae" to mean the para pair satisfied it. Re-reading the source
precisely settled it: it says "two further NON-OPPOSITE caps" — para
specifically means opposite, so the premise was wrong from the start,
not just its execution. Confirmed decisively, not just re-read more
carefully: checking combinatorially, EVERY ONE of the 10 remaining
regions' waist rings shares 2 vertices with the para pair's own
pentagon caps — a direct consequence of RD's vertex configuration
(every vertex belongs to exactly one pentagon, so the para pair's
combined reach already touches every other region's waist ring).
That's exactly why all 10 candidates failed identically in batch 9:
not a coincidence needing transform-tracing to explain, but a real
geometric impossibility baked into the wrong premise. With the
correct pair (RD's "meta" class, 116.6°, matching J74's own
metabigyrate construction) exactly 2 of the remaining 10 regions have
zero waist-ring overlap with either gyrated cap — diminishing either
produces a clean, valid result immediately.

Also checked and ruled out along the way (worth recording since it
was the leading hypothesis walking in): NOT a two-gyrations-composing-
incorrectly bug — the double-gyrate reconstruction that exactly
reproduced J73 already proves 2 simultaneous gyrations compose
correctly in general; the actual issue was specific to which 2 regions
batch 9 chose to gyrate in the first place.

V=55, E=105, F=52 (15 triangles + 25 squares + 11 pentagons + 1
decagon), zero non-square quads, directly confirmed NOT congruent to
J76/J77/J78 (the registry's other diminished/gyrate-diminished RD
variants) via the same pairwise-distance-histogram check used
throughout this project.

Verified end to end: `validate-johnson.ts` (all 79 OK), `tsc --noEmit`
and lint clean, `verify:attach` (356,478), `verify:twist` (250,632),
`verify:rewrite`, `verify:graph`, `verify:face-connectors` (8,803),
`verify:face-attach` (2,903,249, 0 failures), `verify:face-twist`
(22,378, 0 failures), and the full Playwright suite on dicto-node.

Still outstanding for Johnson solids: exactly 8 remain (J85-J92, not
the "~13-15" this section originally estimated — corrected directly
against the registry, not re-estimated). The tooling gap is also
smaller than first thought: checked each of the 8 individually rather
than assuming they're all in the same boat — 6 (J85, J86, J88, J89,
J90, and J87 via J86+a square-pyramid cap) have a *published* defining
polynomial that `numpy.roots()` (already installed, part of this
project's existing numpy/scipy environment, confirmed working on both
a cubic and a degree-16 test case) solves directly; the other 2 (J91,
J92) are pure golden-ratio closed forms needing no root-finding at
all. See `docs/johnson-solids-remaining-spec.md`'s corrected Group 4
section for the full per-shape breakdown and sources.
