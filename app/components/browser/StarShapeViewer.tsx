'use client';

/**
 * Stage 2+4 of docs/star-polyhedra-spec.md: a real, standalone 3D
 * drag-rotate viewer for the 4 Kepler-Poinsot solids, with 4 view modes
 * (Wireframe/Solid/Translucent/Inside view -- the same 3 non-wireframe
 * modes ShapeViewer offers every other shape, plus the original
 * wireframe-only view from Stage 2) -- neither ShapePreview (2D canvas,
 * auto-spin only, no drag, no fill) nor ShapeViewer (its own
 * `triangulateFace` assumes convex, simple faces -- wrong for a
 * pentagram) already does "self-intersecting-face-aware fill, real 3D,
 * user-draggable."
 *
 * Face fill uses starTriangulation.ts's own real, numerically-verified
 * triangulation (winding-number-correct for pentagram faces, plain fan
 * for the 2 solids whose own faces are simple) -- not a shortcut, not an
 * approximation. Still deliberately its own small component rather than
 * a prop flipped on ShapeViewer: mounting the full attach-capable
 * ShapeViewer for a shape it was never built to face-fill correctly (nor
 * should ever be vertex/face-attachable, per starPolyhedra.ts's own
 * header) would be exactly the "leak into the attach system" this
 * family's whole design avoids.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STAR_POLYHEDRA } from '../../lib/polyhedra/starPolyhedra';
import { triangulateStarFace } from '../../lib/polyhedra/starTriangulation';

const LINE_COLOR = 0x47cc24;
const FACE_COLOR = 0x47cc24;

type StarViewMode = 'wireframe' | 'solid' | 'translucent' | 'inside';
const MODES: StarViewMode[] = ['wireframe', 'solid', 'translucent', 'inside'];
const MODE_LABELS: Record<StarViewMode, string> = {
  wireframe: 'Wireframe',
  solid: 'Solid',
  translucent: 'Translucent',
  inside: 'Inside view',
};

export interface StarShapeViewerProps {
  specId: string;
  height?: number;
}

export default function StarShapeViewer({ specId, height = 260 }: StarShapeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meshMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [mode, setMode] = useState<StarViewMode>('solid');

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

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

    const linePositions = new Float32Array(spec.edges.length * 6);
    spec.edges.forEach(([a, b], i) => {
      const [ax, ay, az] = centered[a];
      const [bx, by, bz] = centered[b];
      linePositions.set([ax * scale, ay * scale, az * scale, bx * scale, by * scale, bz * scale], i * 6);
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // Real face fill: triangulateStarFace handles both the 2 solids whose
    // own faces are simple (plain fan) and the 2 whose faces are real
    // pentagrams (winding-number-correct star fill) -- see its own header.
    const facePositions: number[] = [];
    for (const face of spec.faces) {
      const faceVerts3D = face.map((i) => centered[i].map((c) => c * scale) as [number, number, number]);
      for (const [a, b, c] of triangulateStarFace(faceVerts3D)) {
        facePositions.push(...a, ...b, ...c);
      }
    }
    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
    faceGeometry.computeVertexNormals();
    const faceMaterial = new THREE.MeshStandardMaterial({ color: FACE_COLOR, flatShading: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(faceGeometry, faceMaterial);
    scene.add(mesh);
    meshMaterialRef.current = faceMaterial;
    meshRef.current = mesh;

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
      lineGeometry.dispose();
      lineMaterial.dispose();
      faceGeometry.dispose();
      faceMaterial.dispose();
      meshMaterialRef.current = null;
      meshRef.current = null;
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [specId]);

  // Mode changes only ever touch material properties -- never rebuilds
  // the scene/camera/controls, so toggling modes doesn't reset whatever
  // angle the user has already dragged to. Opacity values match
  // ShapeViewer's own applyViewMode exactly (translucent=0.35→0.4 here
  // for a slightly richer star silhouette at this smaller size,
  // inside=0.04) so "Inside view" reads the same way it does for every
  // other shape in the main viewer.
  useEffect(() => {
    const material = meshMaterialRef.current;
    const mesh = meshRef.current;
    if (!material || !mesh) return;
    mesh.visible = mode !== 'wireframe';
    material.transparent = mode !== 'solid';
    material.depthWrite = mode === 'solid';
    material.opacity = mode === 'translucent' ? 0.4 : mode === 'inside' ? 0.04 : 1;
    material.needsUpdate = true;
  }, [mode, specId]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} aria-label="Draggable 3D shape preview" />
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid rgba(71,204,36,.3)',
              background: mode === m ? '#2e8a17' : 'rgba(14,18,9,.85)',
              color: mode === m ? '#04140a' : '#5ee233',
              cursor: 'pointer',
              fontWeight: mode === m ? 700 : 400,
            }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
