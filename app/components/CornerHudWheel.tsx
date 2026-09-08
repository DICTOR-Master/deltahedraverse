'use client';

/**
 * CornerHudWheel — a small, persistent, always-visible dodecahedron
 * medallion, the real visual affordance for "the shape-picker wheel
 * exists here" (replacing/supplementing the plain "Start over with…"
 * text button). Modeled directly on Rhombiverse's `hud-wheel-3d.js`:
 * solid opaque metallic material with black relief edge lines, rotates
 * on drag only (no auto-rotate, no idle animation — direct user
 * decision there: "nothing about it should move on its own"), clicking
 * it opens the full wheel.
 *
 * Color: silver (`HUD_SILVER_HEX`), not Rhombiverse's gold — the same
 * silver-with-black-script direction given for this piece specifically
 * (the main modal wheel is green; silver was always meant for this
 * corner element, not the modal). Black relief lines ported as-is.
 *
 * Deliberately NOT sharing the main ShapeViewer scene's renderer via a
 * scissor sub-viewport the way Rhombiverse's version does (that trick
 * exists there specifically to avoid TWO simultaneous full-screen
 * WebGL renders — this widget is a small ~110px corner canvas next to
 * one full-screen scene, a much smaller perf profile, and ShapeViewer's
 * own render loop is large/established/tested — not worth the coupling
 * risk for this). A small dedicated renderer, same pattern this file's
 * sibling components (ShapeViewer, PolyhedralWheel) already each use
 * for their own canvas.
 *
 * No per-face actions yet (X-Ray/Settings/etc. don't exist in
 * Polyhedraverse) — every face is plain/decorative for now; clicking
 * anywhere on the medallion opens the full PolyhedralWheel. Revisit once
 * this project has its own set of quick-access actions to put on faces.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { POLYHEDRA, triangulateFace } from '../lib/polyhedra';

const HUD_SILVER_HEX = 0xc7ccd1;
const RELIEF_LINE_COLOR = 0x0a0a0c;
const SIZE = 110;

export interface CornerHudWheelProps {
  onOpen: () => void;
}

export default function CornerHudWheel({ onOpen }: CornerHudWheelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const spec = POLYHEDRA.DODECAHEDRON;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0, 3.4);
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
    // A resting angle that shows several faces at once, not one face
    // dead-on (which would read as a flat silver square rather than a
    // 3D medallion).
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
      // Solid and opaque -- deliberately the opposite of the full
      // wheel's near-transparent glass fill (same principle Rhombiverse
      // states for its own hud-wheel-3d.js: this one should read as a
      // real small object sitting in the HUD, not a see-through overlay).
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: HUD_SILVER_HEX, metalness: 0.75, roughness: 0.28, side: THREE.DoubleSide }),
      );
      group.add(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: RELIEF_LINE_COLOR }));
      group.add(line);
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
      // Same drag-vs-click disambiguation as the full wheel -- a drag
      // that ends over the medallion shouldn't also open the wheel.
      if (dragDistance < 5) onOpenRef.current();
    };
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onClick);

    let frameId: number;
    const animate = () => {
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('click', onClick);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="button"
      aria-label="Open shape picker wheel"
      title="Open shape picker (Tab / Space)"
      data-testid="corner-hud-wheel"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: SIZE,
        height: SIZE,
        cursor: 'pointer',
        zIndex: 80,
      }}
    />
  );
}
