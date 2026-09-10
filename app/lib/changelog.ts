/**
 * Hand-curated, user-facing changelog -- NOT auto-generated from git log.
 * Commit messages are written for other developers (internal batch names,
 * "Stage N", lint/CI plumbing); this is written for whoever's using the
 * app. Newest date first, newest entry within a date first. Add a new
 * entry (or a new day's group) here as work lands -- there's no build
 * step or generator to keep in sync, this file IS the source of truth
 * ChangelogOverlay renders directly.
 */

export interface ChangelogDay {
  date: string; // e.g. '2026-09-09'
  entries: string[];
}

export const CHANGELOG: ChangelogDay[] = [
  {
    date: '2026-09-10',
    entries: [
      'Star polyhedra now render Solid and Translucent, not just Wireframe — a real winding-number-correct triangulation fills even the self-intersecting pentagram faces (small/great stellated dodecahedron) correctly, with a mode toggle right on the viewer.',
      'Added a real 3D starfield to the main viewer, plus a starry background behind the page header.',
    ],
  },
  {
    date: '2026-09-09',
    entries: [
      'Added the 4 Kepler-Poinsot star polyhedra (great dodecahedron, small stellated dodecahedron, great icosahedron, great stellated dodecahedron) as a browsable-only reference family in Full Catalog, with real geometry — every construction verified against the published Schläfli/vertex/edge/face/density table, not eyeballed — plus a real drag-to-rotate 3D wireframe viewer in the shape detail drawer.',
      'Full Catalog is now a real scrollable page grouped into family sections, not another layer of wheel pagination — selecting it from the wheel exits the wheel immediately.',
      'Added a one-level Undo button for the scene.',
      'Added an "Export JSON" button to download the current assembly.',
      'Added a dismiss (✕) button to the bottom instruction pill.',
      'Added a "Previous" wheel face (mirroring "More") so paging backward through a large family no longer means cycling through the whole rest of it.',
      'Wheel: fixed a real iPad bug — long-pressing a wheel label triggered the browser’s native copy/select menu instead of selecting the face.',
      'Wheel: every family/shape symbol now sits inside a consistent circular badge, so faces read as a uniform size regardless of which glyph is inside.',
      'Wheel: Platonic now uses a pentagon symbol (a direct count mnemonic — there are five Platonic solids); Johnson took over the diamond it displaced.',
      'Wheel: the app’s language setting now actually changes the wheel’s own chrome text (header, drag hint, Back/Close), not just the ShapeBrowser’s.',
      '"Attach via face…" button recolored to amber/black to match the free-vertex highlight color.',
      'Filled the wheel’s previously half-empty first view with antipodal clones of each family, pairing true duals (Archimedean/Catalan, Prisms/Antiprisms) opposite each other.',
      'Fixed a real per-face hover highlight (previously the whole shape glowed, not just the hovered face).',
      'Fixed z-fighting on internal touching faces after an attach.',
      'Fixed the corner HUD obscuring the Confirm button on attach; switched its render loop to render-on-demand.',
      'Fixed touch/mobile: drag-to-rotate no longer scrolls the page, tooltip text no longer hides under your finger, and iOS Safari’s unreliable drag-delta reporting was replaced with manual tracking.',
      'Wired real actions into the corner HUD: Wheel, Browser, View mode, Save, About, Language.',
      'Added a first-visit welcome overlay, with a cross-link to Rhombiverse (this project’s twin).',
      'Added the karaoke-style ShapeBrowser: search, family/face-shape/face-count facets, favorites, compare, and a scene view.',
      'Completed the full 137-shape registry: added prisms & antiprisms, the last 30 Johnson solids, and the last 11 Catalan solids — all 7 families are now complete.',
      'Deployed to Vercel, with GitHub auto-deploy wired up for every push to main.',
    ],
  },
  {
    date: '2026-09-08',
    entries: [
      'Renamed the project (Deltaverse → Deltahedraverse → Polyhedraverse) and added its logo/branding.',
      'Added the PolyhedralWheel 3D shape picker and the corner HUD medallion.',
      'Built out the geometric registry in stages: all 5 Platonic solids, all 13 Archimedean solids, most of the Johnson solids, and the first 2 Catalan solids.',
      'Added face-to-face attach (face-snap mode) and a view-mode toggle (solid / translucent / inside view).',
      'Built the app from scratch: vertex-attach assembly graph, a D10↔D12 rewrite rule, persistence via an API route, and a permanent Playwright test suite.',
    ],
  },
];
