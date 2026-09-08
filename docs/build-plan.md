# Deltahedraverse Build Plan

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

Still outstanding, in rough order: the remaining 10 Archimedean solids,
Johnson solids (92 — by far the largest remaining lift), re-matching face
connections on rewrite (the gap noted in the face-snap section above),
and an eventual introductory puzzle game (working name DELTIS), which
remains speculative — see vercel-deployment-plan.md and README.md.
