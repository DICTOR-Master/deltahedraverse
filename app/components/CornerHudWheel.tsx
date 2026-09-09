'use client';

/**
 * CornerHudWheel — a small, persistent, always-visible dodecahedron
 * medallion consolidating Polyhedraverse's global shortcuts onto real
 * faces of the shape, replacing separate header buttons for them.
 * Modeled directly on Rhombiverse's `hud-wheel-3d.js`, which states its
 * own intent plainly: "replacing the previous row of 9 individual icon
 * buttons... with symbol faces on the real shape itself."
 *
 * Six real actions -- Wheel (open/close the literal 3D shape picker),
 * Browser (open/close the karaoke-style ShapeBrowser), Object View
 * (cycle Solid/Translucent/Inside — Polyhedraverse's own object-centric
 * equivalent of Rhombiverse's World View toggle), Save, About, and
 * Language (cycles EN/JA/ES/FR, the same rotation ShapeBrowser's own
 * language button already offers, now reachable without opening it
 * first) -- each placed on its own antipodal opposite face too (real
 * user report: with only 6 of 12 faces used, the medallion read as
 * "very empty" mid-drag; same "duplicate a spare rather than leave it
 * blank" policy already used for PolyhedralWheel's own family-selection
 * view and Rhombiverse's own rhombic-wheel-3d-core.js). That fills all
 * 12 faces with no genuinely blank ones left; clicking the medallion
 * body itself (not a specific label) still falls back to opening the
 * wheel, preserving this component's original forgiving "click
 * anywhere opens something useful" behavior.
 *
 * Unlike the original decorative-only version, this stays visible while
 * the wheel/browser are open (Rhombiverse's own HUD is explicitly
 * "always-visible", not something that hides itself once its wheel is
 * up) -- necessary so its own Wheel/Browser faces have something to
 * click to CLOSE them again, not just launch.
 *
 * Labels: bold black-on-white-glow DOM overlays tracking each face's
 * projected screen position every frame -- not text baked into the 3D
 * mesh. This is Rhombiverse's own hard-won choice, not an arbitrary
 * style pick: its hud-wheel-3d.js header records a real, unexplained
 * WebGL rendering bug when symbols were tried as textured planes
 * parented to the rotating mesh (an "engraving"), reverted to this DOM
 * approach per direct user permission there. Recipe copied exactly from
 * that file's own CSS (built for this "black and white on all symbols"
 * requirement already once): color #0a0a0c, font-weight 700,
 * -webkit-text-stroke for glyphs too thin for bold weight to reliably
 * thicken, and a white drop-shadow halo so the dark glyph reads against
 * the medallion's varying, rotation-dependent lighting.
 *
 * Color: silver (`HUD_SILVER_HEX`) mesh with black relief edges,
 * unchanged from the original version -- see the color-identity note in
 * [[polyhedraverse-wheel]] memory for why this stays silver, not green.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { POLYHEDRA, triangulateFace, buildFaceConnectors, type Vec3 } from '../lib/polyhedra';
import type { ViewMode } from './ShapeViewer';
import { usePrefs } from '../lib/prefs';
import { LANG_ORDER } from '../lib/i18n';

const HUD_SILVER_HEX = 0xc7ccd1;
const RELIEF_LINE_COLOR = 0x0a0a0c;
// Started from Rhombiverse's own hud-wheel-3d.js default (size=144),
// then bumped further per direct "still too small" feedback after that
// -- DODECAHEDRON's own circumradius (~1.40) is genuinely larger than
// Rhombiverse's RD (1.0 exactly, verified from rdRawVerts), so matching
// distance/FOV alone doesn't reproduce an equivalent apparent size 1:1;
// rather than keep re-deriving the theoretical ratio, sized directly
// against the actual reported result.
const SIZE = 160;

interface ActionSlot {
  faceIndex: number;
  symbol: string;
  label: string;
  onSelect: () => void;
}

export interface CornerHudWheelProps {
  wheelOpen: boolean;
  browserOpen: boolean;
  onToggleWheel: () => void;
  onToggleBrowser: () => void;
  viewMode: ViewMode;
  onCycleView: () => void;
  onSave: () => void;
  onAbout: () => void;
}

const VIEW_MODE_SHORT: Record<ViewMode, string> = { normal: 'Solid', translucent: 'Translucent', skeleton: 'Inside' };

export default function CornerHudWheel({
  wheelOpen,
  browserOpen,
  onToggleWheel,
  onToggleBrowser,
  viewMode,
  onCycleView,
  onSave,
  onAbout,
}: CornerHudWheelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { language, setLanguage } = usePrefs();

  // Latest-value refs for everything the imperative Three.js effect below
  // needs but shouldn't re-run its whole setup for -- same pattern the
  // original version already used for onOpen, extended to every action.
  const stateRef = useRef({ wheelOpen, browserOpen, viewMode, language });
  useEffect(() => {
    stateRef.current = { wheelOpen, browserOpen, viewMode, language };
  }, [wheelOpen, browserOpen, viewMode, language]);
  const actionsRef = useRef({ onToggleWheel, onToggleBrowser, onCycleView, onSave, onAbout, setLanguage });
  useEffect(() => {
    actionsRef.current = { onToggleWheel, onToggleBrowser, onCycleView, onSave, onAbout, setLanguage };
  }, [onToggleWheel, onToggleBrowser, onCycleView, onSave, onAbout, setLanguage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const spec = POLYHEDRA.DODECAHEDRON;
    const faceConnectors = buildFaceConnectors(spec);

    const scene = new THREE.Scene();
    // FOV and distance both match Rhombiverse's hud-wheel-3d.js exactly
    // (PerspectiveCamera(35, ...), camera.position.set(0,0,7)) rather
    // than a tuned-by-eye guess.
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0, 6);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb8ff, 0.4);
    rim.position.set(-4, -2, -3);
    scene.add(rim);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.set(0.5, 0.6, 0);
    scene.add(group);

    spec.faces.forEach((face) => {
      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      for (const [a, b, c] of triangulateFace(face)) {
        positions.push(...spec.vertices[a], ...spec.vertices[b], ...spec.vertices[c]);
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: HUD_SILVER_HEX, metalness: 0.75, roughness: 0.28, side: THREE.DoubleSide }),
      );
      group.add(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: RELIEF_LINE_COLOR }));
      group.add(line);
    });

    // 6 real actions, DOM-overlay labels (see module header for why not
    // mesh-baked text). Primary face indices are arbitrary but fixed --
    // any 6 of the dodecahedron's 12 do, since the same per-frame
    // facing-based fade/reveal PolyhedralWheel already established
    // handles "which ones are actually visible from the current drag
    // angle." Each also gets a clone on its own antipodal opposite face
    // (see module header) -- DODECAHEDRON's real antipodal pairs,
    // computed directly from buildFaceConnectors' normals (not assumed),
    // are {0,10} {1,4} {2,6} {3,7} {5,9} {8,11}, same pairing table
    // PolyhedralWheel's own family-clone layout uses.
    //
    // The 6 ORIGINAL slots stay first, in this exact order -- __hud-
    // TriggerAction below indexes into buildSlots() by fixed position
    // (0=Wheel..5=Language), so the 6 antipodal clones are appended
    // after them, not interleaved, to keep that mapping stable.
    const buildSlots = (): ActionSlot[] => {
      const s = stateRef.current;
      const a = actionsRef.current;
      const nextLang = LANG_ORDER[(LANG_ORDER.indexOf(s.language) + 1) % LANG_ORDER.length];
      const primary: ActionSlot[] = [
        // Face indices picked by actually computing (not guessing) which
        // of DODECAHEDRON's 12 faces face the camera at this component's
        // resting rotation.set(0.5, 0.6, 0) -- only 3 of 12 clear the
        // facing>0.05 opacity cutoff there (a hard clamp, not a soft
        // fade: 3=0.75, 11=0.60, 2=0.42; everything else is <=0.03).
        // Wheel/Browser/View get those 3, so the most-used actions are
        // visible without any drag; Save/About/Language sit on the next-
        // best faces (10/5/1) and need a small drag to bring into view,
        // same "rotate to discover the rest" pattern PolyhedralWheel's
        // own 12-face wheel already established.
        { faceIndex: 3, symbol: '◐', label: s.wheelOpen ? 'Close wheel' : 'Open wheel', onSelect: a.onToggleWheel },
        { faceIndex: 11, symbol: '◈', label: s.browserOpen ? 'Close browser' : 'Open browser', onSelect: a.onToggleBrowser },
        { faceIndex: 2, symbol: '⛶', label: `View: ${VIEW_MODE_SHORT[s.viewMode]}`, onSelect: a.onCycleView },
        { faceIndex: 10, symbol: '▣', label: 'Save', onSelect: a.onSave },
        { faceIndex: 5, symbol: 'ℹ', label: 'About', onSelect: a.onAbout },
        { faceIndex: 1, symbol: s.language.toUpperCase(), label: `Language: ${nextLang.toUpperCase()}`, onSelect: () => a.setLanguage(nextLang) },
      ];
      const ANTIPODE: Record<number, number> = { 3: 7, 11: 8, 2: 6, 10: 0, 5: 9, 1: 4 };
      const clones: ActionSlot[] = primary.map((slot) => ({ ...slot, faceIndex: ANTIPODE[slot.faceIndex] }));
      return [...primary, ...clones];
    };
    const slotByFace = new Map<number, ActionSlot>();

    const labelEls: HTMLDivElement[] = [];
    const ACTION_FACE_COUNT = 12;
    for (let i = 0; i < ACTION_FACE_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'hud-label';
      container.appendChild(el);
      labelEls.push(el);
    }

    const refreshSlots = () => {
      slotByFace.clear();
      const slots = buildSlots();
      slots.forEach((slot, i) => {
        slotByFace.set(slot.faceIndex, slot);
        labelEls[i].textContent = slot.symbol;
        labelEls[i].title = slot.label;
        labelEls[i].setAttribute('aria-label', slot.label);
      });
    };
    refreshSlots();

    labelEls.forEach((el, i) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation(); // don't also fire the medallion's own body-click fallback below
        const slots = buildSlots();
        setTimeout(() => slots[i]?.onSelect?.(), 0);
      });
    });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragDistance = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      resumeAnimating();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragDistance += Math.hypot(dx, dy);
      group.rotation.y += dx * 0.01;
      group.rotation.x += dy * 0.01;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onClick = () => {
      // Fallback for a click that lands on the medallion body rather
      // than a specific labeled face -- opens the wheel, the same
      // always-works behavior this component had before it grew
      // per-face actions. A label click already stopped propagation
      // above, so this only ever fires for genuinely unlabeled space.
      if (dragDistance < 5) actionsRef.current.onToggleWheel();
    };
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onClick);

    const dirToCamera = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    const labelOpacities = new Array(ACTION_FACE_COUNT).fill(0);

    // Render-on-demand, not an unconditional 60fps loop forever: this is
    // a small, mostly-static medallion, not something that needs
    // continuous rendering when nothing is actually changing (no drag in
    // progress, every label's opacity already settled at its target).
    // Real user report: interaction froze/stuttered specifically once a
    // second shape was attached -- the main scene's own render loop
    // already runs every frame regardless, so this component's own
    // identical unconditional loop was a second full WebGL render every
    // frame, permanently, stacking with however much more the main
    // scene has to draw as an assembly grows. Verified the underlying
    // attach/drag logic itself has no bug (stress-tested a full 2-shape
    // attach sequence, including a large-jump simulated drag, with zero
    // errors/hangs) before treating this as a render-cost problem rather
    // than a logic one. Loop restarts itself from onPointerDown (drag
    // start) below; nothing else needs it, since only rotation (via
    // drag) ever changes what any of this needs to recompute.
    let frameId: number | null = null;
    const animate = () => {
      let stillAnimating = dragging;
      const slots = buildSlots();
      slots.forEach((slot, i) => {
        const fc = faceConnectors[slot.faceIndex];
        const [nx, ny, nz] = fc.normal as Vec3;
        worldNormal.set(nx, ny, nz).applyQuaternion(group.quaternion);
        const [px, py, pz] = fc.pos as Vec3;
        worldPos.set(px, py, pz).applyQuaternion(group.quaternion);
        dirToCamera.copy(camera.position).sub(worldPos).normalize();

        const facing = worldNormal.dot(dirToCamera);
        let targetOpacity = THREE.MathUtils.clamp((facing - 0.05) / 0.5, 0, 1);
        if (facing < -0.3) targetOpacity = 0;
        const prevOpacity = labelOpacities[i];
        labelOpacities[i] = THREE.MathUtils.lerp(labelOpacities[i], targetOpacity, 0.25);
        if (Math.abs(labelOpacities[i] - prevOpacity) > 0.002) stillAnimating = true;

        worldPos.addScaledVector(worldNormal, 0.06);
        worldPos.project(camera);

        const el = labelEls[i];
        const x = ((worldPos.x + 1) / 2) * container.clientWidth;
        const y = ((1 - worldPos.y) / 2) * container.clientHeight;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.opacity = String(labelOpacities[i]);
        el.style.pointerEvents = labelOpacities[i] > 0.3 ? 'auto' : 'none';
      });

      renderer.render(scene, camera);
      frameId = stillAnimating ? requestAnimationFrame(animate) : null;
    };
    animate();

    // Kicks the loop back on if a drag starts after it settled/stopped.
    const resumeAnimating = () => {
      if (frameId === null) {
        frameId = requestAnimationFrame(animate);
      }
    };

    // Testability hook, same pattern as PolyhedralWheel's own __pwGoTo:
    // triggers an action by its fixed slot index (0=Wheel, 1=Browser,
    // 2=View, 3=Save, 4=About, 5=Language, matching buildSlots()'s own
    // order) directly, without needing to solve "which drag angle
    // brings this specific face's label into its clickable >0.3-opacity
    // range" from outside the component.
    (container as unknown as Record<string, unknown>).__hudTriggerAction = (index: number) => {
      buildSlots()[index]?.onSelect();
    };

    // Re-derives labels' text/title (open<->close wording, current view
    // mode, current language) whenever the app's own state changes --
    // the per-frame animate() loop already recomputes positions/opacity
    // every frame regardless, but text content only needs updating on
    // actual change, not 60x/second.
    const interval = window.setInterval(refreshSlots, 250);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.clearInterval(interval);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('click', onClick);
      labelEls.forEach((el) => el.remove());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        .hud-label {
          position: absolute;
          transform: translate(-50%, -50%);
          color: ${`#${RELIEF_LINE_COLOR.toString(16).padStart(6, '0')}`};
          font: 700 15px/1 system-ui, sans-serif;
          -webkit-text-stroke: 1.4px currentColor;
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.85));
          cursor: pointer;
          user-select: none;
          transition: opacity 0.1s linear;
        }
      `}</style>
      <div
        ref={containerRef}
        role="button"
        aria-label="Polyhedraverse shortcuts"
        title="Wheel / Browser / View / Save / About / Language shortcuts"
        data-testid="corner-hud-wheel"
        style={{
          position: 'fixed',
          right: 16,
          // Bottom, not top -- real bug found live: this component's
          // always-visible, high-zIndex box at top:96 could sit directly
          // over the pending-attach "Confirm"/"Cancel" nav (page.tsx's
          // second <nav>, top-anchored, in-flow), silently swallowing
          // taps meant for Confirm instead of passing them through --
          // exactly what looked like "freezing" once a second shape was
          // being attached. Bottom placement removes the conflict
          // structurally rather than patching it with more z-index
          // precedence: nothing else in this app is anchored to the
          // bottom-right corner.
          bottom: 16,
          width: SIZE,
          height: SIZE,
          cursor: 'pointer',
          // Above PolyhedralWheel (990) and ShapeBrowser (985) -- this
          // component no longer hides itself while either is open (see
          // module header), so it needs to actually render on top of
          // them, not underneath, for its own Wheel/Browser close faces
          // to be reachable at all.
          zIndex: 999,
          // Real bug: dragging to rotate this medallion on touch was
          // affecting the WHOLE PAGE before the mesh itself even
          // started turning -- same root cause ShapeViewer.tsx's own
          // container already had fixed (touch-action:none etc.), just
          // never applied here too. Without this, the browser reads a
          // drag on this small fixed element as an ordinary page
          // scroll/pan gesture, since nothing tells it this element
          // means to capture and own that drag exclusively.
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      />
    </>
  );
}
