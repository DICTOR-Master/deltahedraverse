'use client';

/**
 * PolyhedralWheel — a dodecahedron-shaped 3D radial menu for picking a
 * starting shape, replacing the flat "Start over with" button row (which
 * doesn't scale: 29 shapes today, headed toward 100+ once the Johnson
 * family fills in). Ported from Rhombiverse's Rhombic Wheel 3D
 * (`src/app/rhombic-wheel-3d.js`/`-core.js`) — same interaction MECHANICS
 * (per-face labels, drag-vs-click disambiguation, hover/hold-to-reveal
 * text, the `rgba(2,2,6,0.55)` backdrop / `rgba(10,12,20,0.85)` panel
 * opacities) — but a regular dodecahedron instead of a rhombic
 * dodecahedron (the user's own call: 12 faces either way, but "may have
 * less empty space" for Polyhedraverse's use case than a 20-face
 * icosahedron would), and its OWN color identity rather than
 * Rhombiverse's cyan/gold, per direct user request: a metallic silver
 * mesh (`HUD_METAL`) for the wheel object itself, green script/UI
 * (`SCRIPT_COLOR`) for labels and panel chrome. The small always-visible
 * corner HUD element Rhombiverse also has (`hud-wheel-3d.js`) is still
 * out of scope for this pass (see the docstring below) — when it's
 * built, it's silver with black script, not gold, per that same
 * follow-up direction.
 *
 * Scope note: this first pass is the wheel SHELL plus the SHAPE PICKER
 * only (family-grouped: Deltahedra/Platonic/Archimedean/Johnson/Catalan/
 * Prisms/Antiprisms -- 7 families since Prisms and Antiprisms split into
 * two independently browsable families, see app/lib/polyhedra/families.ts),
 * per explicit user direction to build that before folding in actions
 * (augment/diminish), view modes (Spherical/X-Ray), or the corner HUD
 * element above. 7 families fit comfortably within the dodecahedron's 12
 * faces at the family-selection level (one family per face, plus
 * antipodal clones/dual-pairings filling most of the rest -- see
 * `resolveSlots`'s `level.kind === 'families'` branch and its own
 * comment for the exact face layout and the one pair left honestly
 * spare).
 * `FAMILIES` still maps to face slots with no change needed as families are
 * added.
 *
 * Geometry: reuses this registry's own POLYHEDRA.DODECAHEDRON spec
 * directly (vertices + faces already unit-edge, already validated) —
 * never a second hand-declared dodecahedron, same "derive, don't
 * duplicate" rule every other file in app/lib/polyhedra/ already follows.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  POLYHEDRA,
  triangulateFace,
  buildFaceConnectors,
  type Vec3,
} from '../lib/polyhedra';
import { FAMILY_ORDER, FAMILY_META, familyIds, type FamilyKey } from '../lib/polyhedra/families';
import { usePrefs } from '../lib/prefs';
import { t } from '../lib/i18n';

// Interaction mechanics (reveal timing, drag threshold, panel opacity)
// ported exactly from rhombic-wheel-3d.js/-core.js; the COLORS are
// deliberately Polyhedraverse's own, not Rhombiverse's cyan/gold -- green
// throughout (mesh + script/UI), per direct user follow-up correcting an
// earlier silver-mesh/green-script split down to just green, so this
// reads as its own identity rather than a reskinned copy. Silver is
// still the planned color for the small corner HUD element (not built
// yet) -- see the design-record memory for that distinction. The green
// itself was retuned (2026-09-08) to match the project's actual logo
// (public/brand/) rather than an arbitrary pick -- #47CC24 is the
// logo's own dominant sampled color (a warm chartreuse), not the
// bluer/tealer #34D399 (Tailwind's emerald-400) used before the logo
// existed.
const HUD_METAL_HEX = 0x47cc24;
const SCRIPT_COLOR = '#47CC24';
const LABEL_STYLE = {
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontWeight: 700,
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
  fontSizeBase: '16px',
  fontSizeSelected: '19px',
  textShadow: '0 0 10px currentColor, 0 0 2px currentColor, 0 1px 4px rgba(0,0,0,0.9)',
};
const REVEAL_HOLD_MS = 350;
// Fully opaque -- direct user correction: nothing from the app underneath
// (header, nav, View/Save buttons) should show through while the wheel
// is open. Rhombiverse's own equivalent overlay uses 0.55 alpha, not
// ported here on purpose.
const BACKDROP = '#020206';
const PANEL_BG = 'rgba(10, 12, 20, 0.85)';
const PANEL_BORDER = 'rgba(71, 204, 36, 0.5)';
// Drag-vs-click threshold (rhombic-wheel-3d.js's own fix for the same
// "orbiting the wheel also spuriously selects whatever's under the
// cursor on release" bug) -- tracked in screen pixels since pointerdown.
const CLICK_DRAG_THRESHOLD_PX = 5;

interface Family {
  key: FamilyKey;
  label: string;
  symbol: string;
  ids: string[];
}

// Real disparity found live, even after every symbol got a fixed-size
// circular badge (see that CSS comment below): different glyphs -- the
// geometric family symbols, and individual shapes' own single-letter
// symbols (id.slice(0,1)) -- still occupy very different actual ink
// area at an identical font-size (a thin "I" vs a wide "M", a small ★
// vs a filled ⬢), so they still read as inconsistent sizes INSIDE an
// identically sized circle. Measures each glyph's real rendered
// bounding box via Canvas2D (not guessed per-glyph multipliers) and
// scales it toward a common target -- same "verify computationally,
// don't assume" standard this registry's own geometry already holds
// itself to (antipodal face pairs, Catalan/Archimedean duality, etc.).
const SYMBOL_FONT_PX = 36; // must match .pw-label-symbol's font-size below
// Matches globals.css's body rule ("font-family: Arial, Helvetica,
// sans-serif") -- .pw-label-symbol never overrides font-family, so this
// IS what actually renders; measuring a mismatched font would make the
// "measurement" fictional.
const SYMBOL_FONT = `${SYMBOL_FONT_PX}px Arial, Helvetica, sans-serif`;
let measureCtx: CanvasRenderingContext2D | null | undefined;

interface GlyphAdjust {
  scale: number;
  dx: number;
  dy: number;
}
const glyphAdjustCache = new Map<string, GlyphAdjust>();
let referenceGlyphSize: number | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  return measureCtx;
}

function measureGlyphSize(ctx: CanvasRenderingContext2D, symbol: string): number {
  const m = ctx.measureText(symbol);
  const width = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? m.width);
  const height = (m.actualBoundingBoxAscent ?? SYMBOL_FONT_PX * 0.35) + (m.actualBoundingBoxDescent ?? 0);
  return Math.max(width, height, 1);
}

/**
 * Per-symbol scale + pixel offset so every glyph reads as the same size
 * AND sits centered in its circular badge. Two separate, real disparities
 * found live, in order:
 *
 * 1. SIZE: different glyphs -- the geometric family symbols, and
 *    individual shapes' own single-letter symbols (id.slice(0,1)) --
 *    occupy very different actual ink area at an identical font-size (a
 *    thin "I" vs a wide "M", a small ★ vs a filled ⬢). `scale` (below)
 *    corrects this, toward a capital "M"'s own measured size as a
 *    reference (representative of the per-shape letter symbols, which
 *    need the least correction).
 *
 * 2. CENTERING: fixing (1) alone still left the pentagon/diamond/hexagon
 *    family symbols visibly off-center within their badge -- a *.pw-
 *    label-glyph is centered by its PARENT's flexbox, which centers the
 *    glyph's own CSS LAYOUT box (line-height:1 -> the FONT's generic
 *    ascent+descent, IDENTICAL for every character), not that specific
 *    glyph's actual rendered ink. A geometric shape glyph's ink commonly
 *    sits at a different vertical offset within its em-box than a plain
 *    uppercase letter's does, so the same box-centering leaves the INK
 *    itself looking uncentered. `dx`/`dy` correct for exactly that gap
 *    -- computed once, geometrically, from the SAME Canvas2D measurement
 *    already needed for (1) (`fontBoundingBoxAscent/Descent`, the
 *    generic per-font metrics driving line-height:1 layout, vs
 *    `actualBoundingBoxAscent/Descent`, THIS glyph's real ink extent),
 *    not eyeballed per-symbol.
 *
 * Applied together as `transform: translate(dx,dy) scale(k)` -- CSS
 * composes transform-list functions in listed order (the LAST one
 * transforms the point first), so scale happens first (about the
 * glyph's own center, growing/shrinking it in place) and translate then
 * shifts the result by a FIXED dx/dy in real pixels, unaffected by k.
 */
function glyphAdjust(symbol: string): GlyphAdjust {
  const cached = glyphAdjustCache.get(symbol);
  if (cached) return cached;
  const ctx = getMeasureCtx();
  if (!ctx) return { scale: 1, dx: 0, dy: 0 }; // no canvas (shouldn't happen client-side) -- no-op
  ctx.font = SYMBOL_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (referenceGlyphSize === null) referenceGlyphSize = measureGlyphSize(ctx, 'M');
  const scale = THREE.MathUtils.clamp(referenceGlyphSize / measureGlyphSize(ctx, symbol), 0.55, 1.85);

  const m = ctx.measureText(symbol);
  const left = m.actualBoundingBoxLeft ?? 0;
  const right = m.actualBoundingBoxRight ?? m.width;
  const inkAscent = m.actualBoundingBoxAscent ?? SYMBOL_FONT_PX * 0.35;
  const inkDescent = m.actualBoundingBoxDescent ?? 0;
  // Generic per-font metrics (same for every symbol) -- what a
  // `line-height: 1` inline box's own height/baseline position actually
  // derive from, not this glyph's specific ink.
  const fontAscent = m.fontBoundingBoxAscent ?? SYMBOL_FONT_PX * 0.8;
  const fontDescent = m.fontBoundingBoxDescent ?? SYMBOL_FONT_PX * 0.2;

  // Horizontal: the flex-centered box's own width is the text's ADVANCE
  // width (m.width), not its tight ink width (left+right) -- shift so
  // the ink's own center (not the advance box's center) lands in the
  // middle.
  const dx = (m.width - right + left) / 2;
  // Vertical: shift so the ink's center-relative-to-baseline lands where
  // the generic line-box's center-relative-to-baseline currently sits
  // (full derivation in the header comment above).
  const dy = (fontDescent - fontAscent) / 2 + (inkAscent - inkDescent) / 2;

  const result: GlyphAdjust = { scale, dx, dy };
  glyphAdjustCache.set(symbol, result);
  return result;
}

// Family list, order, labels/symbols, and per-family shape ordering are
// all owned by app/lib/polyhedra/families.ts now -- the single source of
// truth shared with the ShapeBrowser, so the wheel and the browser can
// never disagree about family membership. Note this means a shape with a
// documented cross-family membership (e.g. the octahedron: Deltahedra AND
// Antiprisms) is reachable from more than one family face here -- that's
// intended, not a bug to dedupe.
const FAMILIES: Family[] = FAMILY_ORDER.map((key) => ({
  key,
  label: FAMILY_META[key].label,
  symbol: FAMILY_META[key].symbol,
  ids: familyIds(key),
}));

// 12 faces available; family level always fits (7 populated + 5 spare).
// A family's shape level reserves face 11 for "More"/next-page paging
// once its own id list overflows a single page, and face 0 for
// "Previous"/prior-page paging once past page 0 -- real user request:
// "More" only ever wrapped forward, so getting back to an earlier page
// of a large family (Johnson's 92) meant clicking through the whole
// cycle again. 10 content slots per page (not 11) once overflow, to
// leave both nav faces free; a non-overflowing family still uses all 12
// for content since neither nav face is ever needed there.
const CONTENT_FACES_PER_PAGE = 10;
const MORE_FACE_INDEX = 11;
const PREV_FACE_INDEX = 0;

type WheelLevel = { kind: 'families' } | { kind: 'family'; familyIndex: number; page: number };

interface FaceSlot {
  label: string;
  symbol: string;
  spare: boolean;
  onSelect: (() => void) | null;
}

function resolveSlots(
  level: WheelLevel,
  onFamily: (i: number) => void,
  onSelectShape: (id: string) => void,
  onMore: () => void,
  onPrev: () => void,
  filterIds?: string[],
): FaceSlot[] {
  const slots: FaceSlot[] = Array.from({ length: 12 }, () => ({ label: '', symbol: '', spare: true, onSelect: null }));

  if (level.kind === 'families') {
    // Face-slot assignment isn't insertion order anymore -- placed
    // against DODECAHEDRON's real antipodal pairs (computed directly
    // from buildFaceConnectors' normals, not assumed: {0,10} {1,4} {2,6}
    // {3,7} {5,9} {8,11}), per direct request: fill the wheel's
    // otherwise-half-empty first view with clones of each real family on
    // its own opposite pole (same "duplicate a spare rather than leave
    // it blank" policy Rhombiverse's own rhombic-wheel-3d-core.js
    // already uses), while placing the two families with a genuine
    // real-world relationship directly opposite EACH OTHER instead of a
    // clone of themselves: Archimedean/Catalan (true polar duals -- see
    // docs/catalan-solids-spec.md, Catalan solids are literally
    // Archimedean solids reciprocated about their own midsphere, NOT
    // Platonic ones, verified directly rather than assumed from an
    // earlier loosely-worded note) on {1,4}, and Prisms/Antiprisms (not
    // strict duals of each other -- a prism's dual is a bipyramid, an
    // antiprism's is a trapezohedron -- but the one other naturally
    // paired construction family here) on {2,6}. Deltahedra/Platonic/
    // Johnson don't have a natural partner among the remaining families,
    // so each gets a plain clone of itself on its own antipodal face
    // instead: Deltahedra {0,10}, Platonic {3,7}, Johnson {5,9}. That
    // leaves exactly one pair, {8,11}, genuinely spare -- a "Full
    // Catalog" entry lived there briefly but was pulled per direct
    // feedback ("we've lost simplicity"): a plain 7-family wheel with
    // one honestly-empty pair reads more simply than a pseudo-family
    // invented just to fill it.
    const FAMILY_FACE_SLOTS: Record<FamilyKey, number[]> = {
      DELTAHEDRA: [0, 10],
      PLATONIC: [3, 7],
      ARCHIMEDEAN: [1],
      JOHNSON: [5, 9],
      CATALAN: [4],
      PRISMS: [2],
      ANTIPRISMS: [6],
    };
    FAMILIES.forEach((f, i) => {
      // Real user report, confirmed by directly checking every RD
      // (rhombic dodecahedron) face against the full registry: when
      // filterIds is active (face-attach mode), a family can genuinely
      // have ZERO compatible shapes -- RD's rhombic face matches nothing
      // outside Catalan, not even a single Platonic/Archimedean/Johnson
      // shape -- yet every family used to stay clickable regardless, so
      // Platonic (duplicated onto 2 faces, a big target) was ALWAYS a
      // guaranteed dead end for an RD attach, over and over. Leaving a
      // family's face(s) genuinely spare (not clickable) here when it
      // has no compatible shape under the current filter stops that
      // dead end from ever being offered in the first place.
      if (filterIds && !f.ids.some((id) => filterIds.includes(id))) return;
      for (const faceIndex of FAMILY_FACE_SLOTS[f.key]) {
        slots[faceIndex] = { label: f.label, symbol: f.symbol, spare: false, onSelect: () => onFamily(i) };
      }
    });
    return slots;
  }

  const family = FAMILIES[level.familyIndex];
  // Real user feedback ("they should nevertheless show full family
  // members"): pre-filtering incompatible shapes out of view entirely
  // (the old behavior) made a family look incomplete or wrong -- Catalan
  // in particular could look like it had far fewer members than its
  // real 13 depending on what was being face-attached. Every family now
  // always lists its FULL roster, in its normal catalog order/paging,
  // regardless of filterIds -- compatibility only decides which
  // individual entries are selectable (spare + no onSelect, same
  // dim/non-clickable treatment an empty wheel face already gets), never
  // which ones exist at all. (The 'families' level above still skips a
  // family ENTIRELY when it has zero compatible members at all -- e.g.
  // Platonic for an RD attach -- that's a different, still-real dead end
  // this doesn't reverse.)
  const ids = family.ids;
  const overflow = ids.length > CONTENT_FACES_PER_PAGE;
  const perPage = overflow ? CONTENT_FACES_PER_PAGE : 12;
  // Content starts at face 1 (not 0) once paging exists at all, leaving
  // face 0 free for "Previous" -- fixed position regardless of how many
  // items land on this particular page, so it's always in the same spot.
  const contentStart = overflow ? 1 : 0;
  const start = level.page * perPage;
  const pageIds = ids.slice(start, start + perPage);
  // "More" only when items remain AFTER this page's slice -- `overflow`
  // alone (computed once from the total count) would show it on every
  // page including the last, where clicking it wraps back to page 0
  // instead of doing nothing. That bogus trailing "More" was a real bug:
  // it could double-advance past the real last page under the click-
  // ambiguity retry in tests/e2e/utils.ts's clickWheelLabel (a failed-
  // looking click followed by a same-orientation retry that actually
  // lands), silently skipping whatever shapes lived on that final page.
  const hasMore = start + perPage < ids.length;
  const hasPrev = overflow && level.page > 0;

  pageIds.forEach((id, i) => {
    // Catalog number reflects position in the family's own face-type-
    // sorted order above (start + i, 1-indexed) -- a consistent scheme
    // across all 4 families, even the 3 that have no standard numbering
    // of their own (Johnson solids already carry a "J<n>" prefix in
    // their id, so this is slightly redundant there, but consistency
    // across families was worth that small overlap).
    const catalogNumber = start + i + 1;
    const compatible = !filterIds || filterIds.includes(id);
    slots[contentStart + i] = {
      label: `[${catalogNumber}] ${id.replaceAll('_', ' ')}`,
      symbol: id.slice(0, 1),
      spare: !compatible,
      onSelect: compatible ? () => onSelectShape(id) : null,
    };
  });

  if (hasMore) {
    slots[MORE_FACE_INDEX] = { label: 'More', symbol: '→', spare: false, onSelect: onMore };
  }
  if (hasPrev) {
    slots[PREV_FACE_INDEX] = { label: 'Previous', symbol: '←', spare: false, onSelect: onPrev };
  }

  return slots;
}

export interface PolyhedralWheelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (shapeId: string) => void;
  /**
   * When set, only these shape ids are selectable within any family
   * (e.g. face-attach: only shapes with a matching face size are real
   * options). A family with at least one compatible member still lists
   * its FULL roster (incompatible entries shown dim/non-clickable, not
   * removed) -- a family with ZERO compatible members anywhere is
   * skipped entirely at the family-selection level instead of ever
   * being offered as a guaranteed dead end. Omit for the unrestricted
   * "start over with any shape" case.
   */
  filterIds?: string[];
}

export default function PolyhedralWheel({ open, onClose, onSelect, filterIds }: PolyhedralWheelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const [level, setLevel] = useState<WheelLevel>({ kind: 'families' });
  // This component's own top-bar chrome ("Choose a shape family",
  // "Close (Esc)", "← Back") was hardcoded English -- real gap found
  // live: the i18n keys for these already existed (wheel.head/
  // wheel.spin were already translated into all 4 languages), just
  // never actually wired up here, so changing language never visibly
  // affected the wheel at all even though the app-wide language
  // preference genuinely was changing underneath it.
  const { language } = usePrefs();

  // Reset to the family list every time the wheel is (re)opened -- React's
  // own "adjust state during render" pattern (comparing to a *state*
  // -tracked previous prop, not a ref -- ref reads/writes during render
  // aren't safe under concurrent rendering) rather than setState inside a
  // useEffect body, which would trigger an extra cascading render for no
  // benefit here.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && level.kind !== 'families') setLevel({ kind: 'families' });
  }

  const goBack = useCallback(() => {
    setLevel((l) => (l.kind === 'family' ? { kind: 'families' } : l));
  }, []);

  // Read from the scene-setup effect below (which only depends on
  // `[open]`, so it wouldn't otherwise see a filterIds prop change)
  // for its own one-time bootstrap resolveSlots() call.
  const filterIdsRef = useRef(filterIds);
  useEffect(() => {
    filterIdsRef.current = filterIds;
  }, [filterIds]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (level.kind === 'family') goBack();
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, level, goBack, onClose]);

  // Deterministic step-rotation (arrow keys, in addition to the buttons
  // rendered below) -- a dodecahedron has 12 faces spread all around a
  // sphere, so free-drag alone leaves "is the face I want even reachable
  // from here" up to chance. Stepping by a fixed azimuth/polar increment
  // guarantees every face becomes front-facing within a bounded number of
  // steps, which matters as much for real keyboard/accessibility use as
  // it does for automated testing.
  useEffect(() => {
    if (!open) return;
    const onArrowKey = (e: KeyboardEvent) => {
      const container = containerRef.current as unknown as { __pwStep?: (axis: 'azimuth' | 'polar', delta: number) => void } | null;
      if (!container?.__pwStep) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); container.__pwStep('azimuth', -Math.PI / 4); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); container.__pwStep('azimuth', Math.PI / 4); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); container.__pwStep('polar', -Math.PI / 6); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); container.__pwStep('polar', Math.PI / 6); }
    };
    window.addEventListener('keydown', onArrowKey);
    return () => window.removeEventListener('keydown', onArrowKey);
  }, [open]);

  useEffect(() => {
    const container = containerRef.current;
    const labelsHost = labelsRef.current;
    if (!open || !container || !labelsHost) return;

    const spec = POLYHEDRA.DODECAHEDRON;
    const faceConnectors = buildFaceConnectors(spec);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    // Distance matches Rhombiverse's own rhombic-wheel-3d.js exactly
    // (same FOV=45, camera.position.set(0,0,9)) -- 4.2 (barely half of
    // that) was the actual reason this read as too large on narrow
    // screens, same root cause as the corner HUD's own "too tightly
    // boxed" reports just fixed the same way. minDistance/maxDistance
    // below (OrbitControls) are user-facing zoom bounds, unrelated to
    // this starting framing.
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    // Raised from 8 -- the new starting distance (9, matching
    // Rhombiverse) would otherwise get immediately clamped back down to
    // the old 8 on the first controls.update(), silently undoing the
    // pull-back fix above. 12 gives some real zoom-out headroom past the
    // new default too, not just enough to avoid clamping it exactly.
    controls.maxDistance = 12;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    const wheelGroup = new THREE.Group();
    scene.add(wheelGroup);

    const faceMeshes: THREE.Mesh[] = [];
    spec.faces.forEach((face, faceIndex) => {
      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      for (const [a, b, c] of triangulateFace(face)) {
        positions.push(...spec.vertices[a], ...spec.vertices[b], ...spec.vertices[c]);
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: HUD_METAL_HEX,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        metalness: 0.7,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.faceIndex = faceIndex;
      wheelGroup.add(mesh);
      faceMeshes.push(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: HUD_METAL_HEX, transparent: true, opacity: 0.6 }),
      );
      wheelGroup.add(line);
    });

    // 12 label divs, one per dodecahedron face, positioned each frame via
    // 3D->2D projection along the face's own outward normal (offset out
    // past the mesh so the label reads clearly beyond the wireframe) --
    // same "real independent click target, not just a mesh raycast"
    // approach rhombic-wheel-3d.js's own label-click-accuracy fix uses.
    const labelEls: HTMLDivElement[] = [];
    const labelTextEls: HTMLDivElement[] = [];
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div');
      el.className = 'pw-label';
      const symbolEl = document.createElement('div');
      symbolEl.className = 'pw-label-symbol';
      // Glyph lives in its own inner span, separately scaled per-symbol
      // (see glyphScale above) -- scaling symbolEl itself would resize
      // the fixed circular badge along with the glyph, defeating the
      // whole point of a consistent-size badge.
      const glyphEl = document.createElement('span');
      glyphEl.className = 'pw-label-glyph';
      symbolEl.appendChild(glyphEl);
      const textEl = document.createElement('div');
      textEl.className = 'pw-label-text';
      el.appendChild(symbolEl);
      el.appendChild(textEl);
      labelsHost.appendChild(el);
      labelEls.push(el);
      labelTextEls.push(textEl);
    }

    let currentSlots: FaceSlot[] = [];
    const applySlots = (slots: FaceSlot[]) => {
      currentSlots = slots;
      slots.forEach((slot, i) => {
        const mesh = faceMeshes[i];
        (mesh.material as THREE.MeshStandardMaterial).opacity = slot.spare ? 0.08 : 0.24;
        labelEls[i].classList.toggle('spare', slot.spare);
        const glyphEl = labelEls[i].querySelector('.pw-label-glyph') as HTMLElement;
        glyphEl.textContent = slot.symbol;
        const adjust = glyphAdjust(slot.symbol);
        glyphEl.style.transform = `translate(${adjust.dx}px, ${adjust.dy}px) scale(${adjust.scale})`;
        labelTextEls[i].textContent = slot.label;
      });
    };

    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    labelEls.forEach((el, i) => {
      const startReveal = () => {
        clearTimeout(revealTimer);
        revealTimer = setTimeout(() => el.classList.add('reveal'), REVEAL_HOLD_MS);
      };
      const endReveal = () => {
        clearTimeout(revealTimer);
        el.classList.remove('reveal');
      };
      el.addEventListener('pointerdown', startReveal);
      el.addEventListener('pointerup', endReveal);
      el.addEventListener('pointercancel', endReveal);
      el.addEventListener('pointerenter', (ev) => {
        if ((ev as PointerEvent).pointerType !== 'touch') el.classList.add('reveal');
      });
      el.addEventListener('pointerleave', (ev) => {
        if ((ev as PointerEvent).pointerType !== 'touch') el.classList.remove('reveal');
      });
      el.addEventListener('click', () => {
        // Deferred to the next tick, not called synchronously here -- the
        // selected slot's onSelect can trigger a React state update
        // (navigating a level, or resetting the whole app) that mutates
        // this very label's DOM text before the browser's (and, in
        // Playwright-driven tests, the automation layer's) own click
        // event dispatch has fully finished processing it. A real bug,
        // not just test flakiness: caught via an e2e test that reliably
        // got "element no longer matches" failures immediately after a
        // successful click, traced to this exact synchronous mutation.
        const slot = currentSlots[i];
        setTimeout(() => slot?.onSelect?.(), 0);
      });
    });

    const raycaster = new THREE.Raycaster();
    let dragDistance = 0;
    const onContainerPointerDown = (down: PointerEvent) => {
      dragDistance = 0;
      // Manually-tracked clientX/Y delta, not event.movementX/Y --
      // Safari's support for movementX/Y on touch-originated
      // PointerEvents is unreliable (often 0 regardless of real finger
      // movement), which would leave dragDistance permanently under the
      // click-suppress threshold on touch and make every drag get
      // misread as a click. See ShapeViewer.tsx's own identical fix.
      let lastX = down.clientX;
      let lastY = down.clientY;
      const move = (ev: PointerEvent) => {
        dragDistance += Math.hypot(ev.clientX - lastX, ev.clientY - lastY);
        lastX = ev.clientX;
        lastY = ev.clientY;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    container.addEventListener('pointerdown', onContainerPointerDown);

    const onContainerClick = (e: MouseEvent) => {
      if (dragDistance > CLICK_DRAG_THRESHOLD_PX) return;
      const rect = container.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(faceMeshes)[0];
      if (!hit) return;
      const faceIndex = (hit.object.userData as { faceIndex: number }).faceIndex;
      const slot = currentSlots[faceIndex];
      setTimeout(() => slot?.onSelect?.(), 0);
    };
    container.addEventListener('click', onContainerClick);

    const dirToCamera = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    // Smoothed per-face opacity, persisted across frames -- lerped toward
    // its target rather than snapped, same as Rhombiverse's own model.
    const labelOpacities = new Array(12).fill(0);
    let frameId: number;
    const animate = () => {
      controls.update();

      faceConnectors.forEach((fc, i) => {
        const [nx, ny, nz] = fc.normal as Vec3;
        worldNormal.set(nx, ny, nz).applyQuaternion(wheelGroup.quaternion);

        const [px, py, pz] = fc.pos as Vec3;
        worldPos.set(px, py, pz).applyQuaternion(wheelGroup.quaternion);
        dirToCamera.copy(camera.position).sub(worldPos).normalize();

        // Rhombiverse's own visibility model (rhombic-wheel-3d-core.js's
        // computeLabelVisibility): a smooth fade from facing=0.05 (just
        // starting to turn toward camera) to facing=0.55 (full opacity),
        // with a hard cutoff below facing=-0.3 -- not a binary snap the
        // way an earlier version of this file did it (either fully shown
        // or fully hidden the instant a fixed dot-product threshold was
        // crossed).
        const facing = worldNormal.dot(dirToCamera);
        let targetOpacity = THREE.MathUtils.clamp((facing - 0.05) / 0.5, 0, 1);
        if (facing < -0.3) targetOpacity = 0;
        const spare = currentSlots[i]?.spare ?? true;
        if (spare) targetOpacity *= 0.4; // dim, not full-bright, for empty faces

        labelOpacities[i] = THREE.MathUtils.lerp(labelOpacities[i], targetOpacity, 0.25);

        // Pushed out just far enough to clear the translucent face mesh
        // for legibility/raycasting, not so far the label visibly floats
        // away from its face -- 0.35 (roughly half the dodecahedron's own
        // face inradius at unit edge length) read as "coming away from
        // faces" per direct user feedback; 0.06 keeps the label reading
        // as anchored to the face surface.
        worldPos.addScaledVector(worldNormal, 0.06);
        worldPos.project(camera);

        const el = labelEls[i];
        const x = ((worldPos.x + 1) / 2) * container.clientWidth;
        const y = ((1 - worldPos.y) / 2) * container.clientHeight;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.opacity = String(labelOpacities[i]);
        el.style.pointerEvents = !spare && targetOpacity > 0.3 ? 'auto' : 'none';
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();
    applySlots(resolveSlots(level, () => {}, () => {}, () => {}, () => {}, filterIdsRef.current));

    const onResize = () => {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Re-derives azimuth/polar from the camera's CURRENT position every
    // call (rather than tracking separate state that could drift out of
    // sync with a free mouse-drag via OrbitControls) so a keyboard/button
    // step always continues smoothly from wherever a drag left off.
    const stepCamera = (axis: 'azimuth' | 'polar', delta: number) => {
      const p = camera.position;
      const r = p.length();
      let azimuth = Math.atan2(p.x, p.z);
      let polar = Math.acos(THREE.MathUtils.clamp(p.y / r, -1, 1));
      if (axis === 'azimuth') azimuth += delta;
      else polar = THREE.MathUtils.clamp(polar + delta, 0.35, Math.PI - 0.35);
      camera.position.set(r * Math.sin(polar) * Math.sin(azimuth), r * Math.cos(polar), r * Math.sin(polar) * Math.cos(azimuth));
      camera.lookAt(0, 0, 0);
      controls.update();
    };

    // Absolute variant of stepCamera, for programmatic navigation (e.g.
    // an e2e test doing a bounded search for a specific face) where
    // "reset to a known orientation" is more useful than "nudge from
    // wherever the camera happens to be." Not exposed in the UI itself --
    // real interaction always goes through the relative step()/drag.
    const goToCamera = (azimuthIndex: number, polarIndex: number) => {
      const r = camera.position.length() || 9;
      const azimuth = azimuthIndex * (Math.PI / 4);
      const polar = THREE.MathUtils.clamp(Math.PI / 2 + polarIndex * (Math.PI / 6), 0.35, Math.PI - 0.35);
      camera.position.set(r * Math.sin(polar) * Math.sin(azimuth), r * Math.cos(polar), r * Math.sin(polar) * Math.cos(azimuth));
      camera.lookAt(0, 0, 0);
      controls.update();
    };

    Object.assign(container as unknown as Record<string, unknown>, {
      __pwApplySlots: applySlots,
      __pwStep: stepCamera,
      __pwGoTo: goToCamera,
    });

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(revealTimer);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('pointerdown', onContainerPointerDown);
      container.removeEventListener('click', onContainerClick);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      labelEls.forEach((el) => el.remove());
      faceMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-apply face slots whenever the level (family/page) changes, without
  // tearing down and rebuilding the whole THREE scene.
  useEffect(() => {
    const container = containerRef.current as unknown as { __pwApplySlots?: (s: FaceSlot[]) => void } | null;
    if (!container?.__pwApplySlots) return;
    const slots = resolveSlots(
      level,
      (familyIndex) => setLevel({ kind: 'family', familyIndex, page: 0 }),
      (id) => {
        onSelect(id);
        onClose();
      },
      () => {
        setLevel((l) => {
          if (l.kind !== 'family') return l;
          // Full roster always (see resolveSlots' own comment) -- paging
          // no longer depends on filterIds at all.
          const family = FAMILIES[l.familyIndex];
          const pages = Math.ceil(family.ids.length / CONTENT_FACES_PER_PAGE);
          return { ...l, page: (l.page + 1) % pages };
        });
      },
      () => {
        // No modulo/wrap here -- resolveSlots only ever shows "Previous"
        // when level.page > 0 (hasPrev), so this is always a valid
        // in-range decrement, never called from page 0.
        setLevel((l) => (l.kind === 'family' ? { ...l, page: l.page - 1 } : l));
      },
      filterIds,
    );
    container.__pwApplySlots(slots);
  }, [level, onSelect, onClose, filterIds]);

  const step = (axis: 'azimuth' | 'polar', delta: number) => {
    const container = containerRef.current as unknown as { __pwStep?: (axis: 'azimuth' | 'polar', delta: number) => void } | null;
    container?.__pwStep?.(axis, delta);
  };

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 990, background: BACKDROP }}
      role="dialog"
      aria-label="Shape picker wheel"
    >
      <style>{`
        /* NOT display:flex on .pw-label itself -- a flex column's own box
           (symbol + gap + text) is what would get centered by
           translate(-50%,-50%) below, so a hidden-but-still-laid-out text
           child (opacity alone doesn't remove it from flow) would pull
           that centering point up off the symbol itself, visibly
           off-center from the real face anchor. Same bug, same fix, as
           Rhombiverse's own rhombic-wheel-3d.js .has-icon rule (its own
           comment there explains this in detail). The symbol is the only
           thing establishing .pw-label's box now; the text is taken out
           of flow entirely (position:absolute) and anchored above the
           symbol's own top edge, so it can never affect centering,
           revealed or not.
           .pw-label-symbol itself IS a fixed-size flex box (not just a
           block at a fixed font-size) -- real inconsistency
           found live: different glyphs (the geometric family symbols
           △⬠⬡⬢▭▬★◇, and individual shapes' own single-letter symbols,
           e.g. "T"/"J"/"I"/"W") occupy very different actual ink area at
           an identical font-size, so faces read as noticeably different
           sizes even though nothing was numerically different. Giving
           every symbol the same fixed circular badge -- diameter fixed,
           glyph centered inside via flex -- makes the WHEEL FACE ITSELF
           a consistent size regardless of which glyph happens to be
           inside it, which is what actually reads as "consistent size"
           at a glance (a thin ring, not a pentagon: a circle doesn't
           visually compete with any of the family symbols' own polygon
           shapes the way another polygon frame would). */
        .pw-label {
          position: absolute; transform: translate(-50%, -50%);
          cursor: pointer; opacity: 0; transition: opacity 0.1s ease;
          text-align: center;
          /* Real iPad bug found live: once a revealed label's
             pointerEvents flips to 'auto' below (for click-accuracy --
             see the comment on that toggle), a long-press directly on
             its letter/symbol text hit the browser's own native text
             selection/"Copy" callout instead of this component's click
             handler, since nothing here had ever suppressed it -- the
             touch-action/user-select fix applied to the canvas container
             elsewhere in this file never covered these separate
             DOM-overlay label elements. */
          touch-action: manipulation;
          -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        }
        .pw-label.spare { cursor: default; }
        .pw-label-symbol {
          display: flex; align-items: center; justify-content: center;
          box-sizing: border-box;
          width: 68px; height: 68px; border-radius: 50%;
          border: 1.5px solid ${PANEL_BORDER};
          background: ${PANEL_BG};
          font-size: 36px; line-height: 1; color: ${SCRIPT_COLOR};
          text-shadow: ${LABEL_STYLE.textShadow};
        }
        .pw-label-glyph {
          display: inline-block; /* transform:scale needs a box, not a bare inline run */
        }
        .pw-label-text {
          position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%);
          margin-bottom: 6px;
          color: ${SCRIPT_COLOR};
          font-family: ${LABEL_STYLE.fontFamily};
          font-weight: ${LABEL_STYLE.fontWeight};
          letter-spacing: ${LABEL_STYLE.letterSpacing};
          text-transform: ${LABEL_STYLE.textTransform};
          font-size: ${LABEL_STYLE.fontSizeBase};
          text-shadow: ${LABEL_STYLE.textShadow};
          white-space: nowrap;
          opacity: 0; transition: opacity 0.15s ease;
        }
        .pw-label.reveal .pw-label-text { opacity: 1; }
      `}</style>
      <div
        ref={containerRef}
        data-testid="polyhedral-wheel-scene"
        // Same real bug/fix as CornerHudWheel and ShapeViewer's own
        // containers: without this, a drag-to-rotate gesture on touch
        // reads as an ordinary page scroll/pan first, not a rotation of
        // this scene, since nothing tells the browser to let OrbitControls
        // own that drag exclusively.
        style={{
          position: 'absolute',
          inset: 0,
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      />
      <div ref={labelsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 8,
          color: SCRIPT_COLOR,
          fontFamily: LABEL_STYLE.fontFamily,
          fontSize: 13,
          letterSpacing: '1px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <span>
          {level.kind === 'families'
            ? t('wheel.head', language)
            : t('wheel.drag', language, { family: FAMILIES[level.familyIndex].label })}
        </span>
        {level.kind === 'family' && (
          <button
            type="button"
            onClick={goBack}
            style={{ background: 'none', border: `1px solid ${PANEL_BORDER}`, color: SCRIPT_COLOR, borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}
          >
            {t('action.back', language)}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: `1px solid ${PANEL_BORDER}`, color: SCRIPT_COLOR, borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}
        >
          {t('wheel.close', language)}
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 40px)',
          gridTemplateRows: 'repeat(2, 40px)',
          gap: 4,
        }}
      >
        <RotateButton label="▴" gridArea="1 / 2" onClick={() => step('polar', -Math.PI / 6)} title="Rotate up (↑)" />
        <RotateButton label="‹" gridArea="2 / 1" onClick={() => step('azimuth', -Math.PI / 4)} title="Rotate left (←)" />
        <RotateButton label="›" gridArea="2 / 3" onClick={() => step('azimuth', Math.PI / 4)} title="Rotate right (→)" />
        <RotateButton label="▾" gridArea="2 / 2" onClick={() => step('polar', Math.PI / 6)} title="Rotate down (↓)" />
      </div>
    </div>
  );
}

function RotateButton({ label, gridArea, onClick, title }: { label: string; gridArea: string; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        gridArea,
        background: PANEL_BG,
        border: `1px solid ${PANEL_BORDER}`,
        color: SCRIPT_COLOR,
        borderRadius: 6,
        fontSize: 16,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
