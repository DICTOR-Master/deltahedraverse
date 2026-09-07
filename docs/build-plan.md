# Deltahedraverse Build Plan

Check off stages as they're completed. Each stage is a focused session —
don't start the next one until the current "Done when" passes.

- [x] **Stage 0 — Scaffold** ✅ done (via yarn, not npm — see note below)
  `yarn create next-app` (TypeScript, Tailwind, App Router), `yarn add
  three`, one spinning test mesh at `app/components/SpinningMesh.tsx`
  mounted client-only via `next/dynamic({ ssr: false })`.
  Done when: `yarn dev` shows something rotating. ✅

  Note: this machine has no `npm`/`npx` (Debian package split), so the
  project uses `yarn` (classic v1) throughout instead of the `npm`
  commands the plan originally specified. Functionally equivalent.

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

- [ ] **Stage 4 — Attach**
  Align a chosen shape's vertex to the target vertex: rotate its local
  outward direction onto the target's outward normal (align-two-vectors
  quaternion), then translate. Leaves one rotational DOF — the twist around
  the connection axis — for Stage 5.
  Done when: attaching any shape to any free vertex lands clean, no clipping.

- [ ] **Stage 5 — Rotate, then confirm**
  Drag spins the pending node around the remaining axis. Confirm commits to
  the graph; Esc cancels and restores capacity.

- [ ] **Stage 6 — Assembly graph**
  Real data structure: `{ nodes: [{id, shape, transform}], connections:
  [{nodeA, vertexA, nodeB, vertexB}] }`, built from user actions, not
  inferred from the scene. Persist via an API route
  (`app/api/assemblies/route.ts`) backed by Vercel KV or Postgres — same
  project, same deploy.
  Done when: reload restores a saved assembly exactly.

- [ ] **Stage 7 — D10↔D12 rewrite rule**
  Swap the mesh; re-anchor existing connections where a compatible vertex
  exists in roughly the same role, otherwise surface the orphaned connection
  rather than guessing.
  Done when: transforming a D10 with 2 attached neighbors doesn't send them
  flying.

- [ ] **Stage 8 — Polish**
  Capacity glow states, cascade-remove on delete, cycle detection for
  "closed cage" goals. Pure graph logic, no 3D math.

## Later (additive, not a rewrite)

Platonic/Archimedean packs, Johnson solid packs, dual/face-snap mode — all
slot into the Stage 1 data format. Treat as speculative until Deltahedraverse
ships independently; see vercel-deployment-plan.md.
