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

- [ ] **Stage 8 — Polish**
  Capacity glow states, cascade-remove on delete, cycle detection for
  "closed cage" goals. Pure graph logic, no 3D math.

## Later (additive, not a rewrite)

Platonic/Archimedean packs, Johnson solid packs, dual/face-snap mode — all
slot into the Stage 1 data format. Treat as speculative until Deltahedraverse
ships independently; see vercel-deployment-plan.md.
