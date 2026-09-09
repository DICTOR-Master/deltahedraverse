'use client';

/**
 * Stage 2 of docs/star-polyhedra-spec.md: a real, standalone 3D drag-
 * rotate viewer for the 4 Kepler-Poinsot solids -- neither ShapePreview
 * (2D canvas, auto-spin only, no drag) nor ShapeViewer (solid-triangulated,
 * still deliberately out of scope for self-intersecting faces) already
 * does "wireframe-only, real 3D, user-draggable." Renders ONLY
 * THREE.LineSegments over spec.edges -- no BufferGeometry face mesh at
 * all -- so the star-face triangulation problem never comes up here by
 * construction, not by omission.
 *
 * Deliberately its own small component rather than a prop flipped on
 * ShapeViewer: mounting the full attach-capable ShapeViewer for a shape
 * whose faces it was never built to fill would be exactly the kind of
 * "leak into the attach system" this family's whole design avoids (see
 * starPolyhedra.ts's own header).
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STAR_POLYHEDRA } from '../../lib/polyhedra/starPolyhedra';

const LINE_COLOR = 0x47cc24;

export interface StarWireframeViewerProps {
  specId: string;
  height?: number;
}

export default function StarWireframeViewer({ specId, height = 260 }: StarWireframeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const spec = STAR_POLYHEDRA[specId];
    if (!container || !spec) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 3.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 8;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;
    // Real drag hands control to the user permanently -- auto-spin is only
    // a "this is alive" cue before the first interaction, not a fight
    // against whatever angle the user actually drags to.
    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopAutoRotate);

    // Same normalization ShapePreview.tsx uses: center on centroid, scale
    // by max vertex radius, so every solid (12 or 20 vertices, very
    // different raw coordinate magnitudes) fills the view consistently.
    const verts = spec.vertices;
    const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
    const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
    const cz = verts.reduce((s, v) => s + v[2], 0) / verts.length;
    const centered = verts.map((v) => [v[0] - cx, v[1] - cy, v[2] - cz] as [number, number, number]);
    const maxR = Math.max(...centered.map(([x, y, z]) => Math.sqrt(x * x + y * y + z * z)), 1e-6);
    const scale = 1 / maxR;

    const positions = new Float32Array(spec.edges.length * 6);
    spec.edges.forEach(([a, b], i) => {
      const [ax, ay, az] = centered[a];
      const [bx, by, bz] = centered[b];
      positions.set([ax * scale, ay * scale, az * scale, bx * scale, by * scale, bz * scale], i * 6);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: LINE_COLOR });
    const lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);

    let frameId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', stopAutoRotate);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [specId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, touchAction: 'none' }}
      aria-label="Draggable 3D wireframe preview"
    />
  );
}
