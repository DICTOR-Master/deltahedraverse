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
 * faces at the family-selection level (one family per face, 5 spare) --
 * see `resolveSlots`'s `level.kind === 'families'` branch, which maps
 * `FAMILIES` 1:1 onto face slots with no change needed as families are
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
import { FAMILY_ORDER, FAMILY_META, familyIds } from '../lib/polyhedra/families';

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
  key: string;
  label: string;
  symbol: string;
  ids: string[];
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
// A family's shape level reserves face 11 for "More" paging once its
// own id list overflows 11 content slots (today only Archimedean does,
// at 13 -- Johnson will too once later batches grow past 11).
const CONTENT_FACES_PER_PAGE = 11;
const MORE_FACE_INDEX = 11;

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
  filterIds?: string[],
): FaceSlot[] {
  const slots: FaceSlot[] = Array.from({ length: 12 }, () => ({ label: '', symbol: '', spare: true, onSelect: null }));

  if (level.kind === 'families') {
    FAMILIES.forEach((f, i) => {
      slots[i] = { label: f.label, symbol: f.symbol, spare: false, onSelect: () => onFamily(i) };
    });
    return slots;
  }

  const family = FAMILIES[level.familyIndex];
  // When filtering (e.g. picking a shape to face-attach: only shapes
  // with a matching face size are real options), incompatible shapes
  // are dropped from view entirely rather than shown disabled -- fewer,
  // relevant faces to browse, and it reuses the exact same
  // pagination/slotting logic below unchanged.
  const ids = filterIds ? family.ids.filter((id) => filterIds.includes(id)) : family.ids;
  const overflow = ids.length > CONTENT_FACES_PER_PAGE;
  const perPage = overflow ? CONTENT_FACES_PER_PAGE : 12;
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

  pageIds.forEach((id, i) => {
    // Catalog number reflects position in the family's own face-type-
    // sorted order above (start + i, 1-indexed) -- a consistent scheme
    // across all 4 families, even the 3 that have no standard numbering
    // of their own (Johnson solids already carry a "J<n>" prefix in
    // their id, so this is slightly redundant there, but consistency
    // across families was worth that small overlap).
    const catalogNumber = start + i + 1;
    slots[i] = {
      label: `[${catalogNumber}] ${id.replaceAll('_', ' ')}`,
      symbol: id.slice(0, 1),
      spare: false,
      onSelect: () => onSelectShape(id),
    };
  });

  if (hasMore) {
    slots[MORE_FACE_INDEX] = { label: 'More', symbol: '→', spare: false, onSelect: onMore };
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
   * options) -- incompatible shapes are dropped from view entirely, not
   * shown disabled. Omit for the unrestricted "start over with any
   * shape" case.
   */
  filterIds?: string[];
}

export default function PolyhedralWheel({ open, onClose, onSelect, filterIds }: PolyhedralWheelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const [level, setLevel] = useState<WheelLevel>({ kind: 'families' });

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
    camera.position.set(0, 0, 4.2);

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
    controls.maxDistance = 8;

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
        labelEls[i].querySelector('.pw-label-symbol')!.textContent = slot.symbol;
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
    const onContainerPointerDown = () => {
      dragDistance = 0;
      const move = (ev: PointerEvent) => {
        dragDistance += Math.hypot(ev.movementX, ev.movementY);
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
    applySlots(resolveSlots(level, () => {}, () => {}, () => {}, filterIdsRef.current));

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
      const r = camera.position.length() || 4.2;
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
          const family = FAMILIES[l.familyIndex];
          const ids = filterIds ? family.ids.filter((id) => filterIds.includes(id)) : family.ids;
          const pages = Math.ceil(ids.length / CONTENT_FACES_PER_PAGE);
          return { ...l, page: (l.page + 1) % pages };
        });
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
        /* NOT display:flex -- a flex column's own box (symbol + gap + text)
           is what would get centered by translate(-50%,-50%) below, so a
           hidden-but-still-laid-out text child (opacity alone doesn't
           remove it from flow) would pull that centering point up off the
           symbol itself, visibly off-center from the real face anchor.
           Same bug, same fix, as Rhombiverse's own rhombic-wheel-3d.js
           .has-icon rule (its own comment there explains this in detail).
           The symbol is the only thing establishing .pw-label's box now;
           the text is taken out of flow entirely (position:absolute) and
           anchored above the symbol's own top edge, so it can never
           affect centering, revealed or not. */
        .pw-label {
          position: absolute; transform: translate(-50%, -50%);
          cursor: pointer; opacity: 0; transition: opacity 0.1s ease;
          text-align: center;
        }
        .pw-label.spare { cursor: default; }
        .pw-label-symbol {
          display: block; font-size: 56px; line-height: 1; color: ${SCRIPT_COLOR};
          text-shadow: ${LABEL_STYLE.textShadow};
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
      <div ref={containerRef} data-testid="polyhedral-wheel-scene" style={{ position: 'absolute', inset: 0 }} />
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
          {level.kind === 'families' ? 'Choose a shape family' : `${FAMILIES[level.familyIndex].label} — drag to orbit, click a face`}
        </span>
        {level.kind === 'family' && (
          <button
            type="button"
            onClick={goBack}
            style={{ background: 'none', border: `1px solid ${PANEL_BORDER}`, color: SCRIPT_COLOR, borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: `1px solid ${PANEL_BORDER}`, color: SCRIPT_COLOR, borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}
        >
          Close (Esc)
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
