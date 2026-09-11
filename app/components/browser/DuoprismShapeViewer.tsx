'use client';

/**
 * Reference-only 3D preview of a shape's own 4D Prism (duoprism)
 * construction (see app/lib/polyhedra/duoprism.ts) -- available for ALL
 * 137 registered shapes, unlike the star-polyhedra reference viewer's
 * fixed 4-shape family, since a duoprism is well-defined and always
 * exact for any polyhedron, not just the 4 FOURD_CAPABLE ones (those 4
 * additionally get a real, interactive, scene-buildable version via
 * "Attach via Duoprism…" in the main viewer -- this component is purely
 * a standalone illustration, structurally separate from that attach-
 * capable engine, mirroring StarShapeViewer.tsx's own "never leak into
 * the attach system" reasoning).
 *
 * Shows two copies of the shape (near/far "caps", translated along
 * duoprism.ts's own fixed DUOPRISM_VIEW_AXIS) plus one connecting
 * wall-prism cell per face -- most wall-prisms render OBLIQUE under
 * this single shared axis (correct and expected, matching a real
 * tesseract diagram's own skewed-frustum cells under one projection
 * direction, not a bug).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { POLYHEDRA, triangulateFace, type PolyhedronSpec } from '../../lib/polyhedra';
import { buildDuoprismShadow, wallLateralFaces, type WallPrismRaw } from '../../lib/polyhedra/duoprism';

const CAP_COLOR = 0x47cc24;
const WALL_COLOR = 0x2ad6c9; // matches the "Attach via Duoprism…" button's own teal accent

type DuoprismViewMode = 'solid' | 'translucent';
const MODES: DuoprismViewMode[] = ['solid', 'translucent'];
const MODE_LABELS: Record<DuoprismViewMode, string> = { solid: 'Solid', translucent: 'Translucent' };

export interface DuoprismShapeViewerProps {
  specId: string;
  height?: number | string;
}

function capGeometry(spec: PolyhedronSpec, vertices: readonly (readonly number[])[], scale: number, offset: THREE.Vector3): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const face of spec.faces) {
    for (const [i, j, k] of triangulateFace(face)) {
      for (const idx of [i, j, k]) {
        const v = vertices[idx];
        positions.push(v[0] * scale + offset.x, v[1] * scale + offset.y, v[2] * scale + offset.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Lateral faces only -- both caps are already drawn separately by
// capGeometry above; including the wall's own cap triangles too would
// duplicate that geometry with a different (reversed) triangulation,
// visibly crossing near the middle (see duoprism.ts's own
// wallLateralFaces doc comment).
function wallGeometry(wall: WallPrismRaw, scale: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const face of wallLateralFaces(wall)) {
    for (const [i, j, k] of triangulateFace(face)) {
      for (const idx of [i, j, k]) {
        const v = wall.verts[idx];
        positions.push(v[0] * scale, v[1] * scale, v[2] * scale);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export default function DuoprismShapeViewer({ specId, height = 260 }: DuoprismShapeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Two separate single-value refs (matching StarShapeViewer.tsx's own
  // proven pattern) rather than one array-valued ref -- an array whose
  // ELEMENTS get mutated inside the mode-change effect below trips
  // react-hooks/immutability's static analysis in a way a single ref
  // value doesn't.
  const capMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const wallMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const [mode, setMode] = useState<DuoprismViewMode>('solid');

  useEffect(() => {
    const container = containerRef.current;
    const spec = POLYHEDRA[specId];
    if (!container || !spec) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a10); // same navy-black as ShapeViewer's own real Scene / StarShapeViewer
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;
    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopAutoRotate);

    const shadow = buildDuoprismShadow(spec);
    // Same centroid/max-radius normalization convention as
    // StarShapeViewer/ShapePreview, but measured across the WHOLE
    // duoprism (both caps + walls combined, not just the base shape) so
    // the offset direction's own extent is accounted for in the fit.
    const allPoints: [number, number, number][] = [...spec.vertices, ...shadow.farVertices] as [number, number, number][];
    const cx = allPoints.reduce((s, v) => s + v[0], 0) / allPoints.length;
    const cy = allPoints.reduce((s, v) => s + v[1], 0) / allPoints.length;
    const cz = allPoints.reduce((s, v) => s + v[2], 0) / allPoints.length;
    const maxR = Math.max(...allPoints.map(([x, y, z]) => Math.hypot(x - cx, y - cy, z - cz)), 1e-6);
    const scale = 1 / maxR;
    const centerOffset = new THREE.Vector3(-cx, -cy, -cz);

    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

    const recenterScaled = centerOffset.clone().multiplyScalar(scale);
    const nearGeom = capGeometry(spec, spec.vertices, scale, recenterScaled);
    // farVertices already has the far cap's real position AND orientation
    // baked in (a 180deg-flipped copy, not a plain translation -- see
    // buildDuoprismShadow's own comment); apply the SAME recenter+scale
    // as near, with no extra offset added on top.
    const farGeom = capGeometry(spec, shadow.farVertices, scale, recenterScaled);
    const capMaterial = new THREE.MeshStandardMaterial({ color: CAP_COLOR, flatShading: true, side: THREE.DoubleSide });
    disposables.push(nearGeom, farGeom, capMaterial);
    scene.add(new THREE.Mesh(nearGeom, capMaterial));
    scene.add(new THREE.Mesh(farGeom, capMaterial));
    capMaterialRef.current = capMaterial;

    const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, flatShading: true, side: THREE.DoubleSide });
    disposables.push(wallMaterial);
    for (const wall of shadow.walls) {
      // Wall vertices are already in spec's own local frame (no extra
      // per-wall offset needed) -- just recenter+scale the same way.
      const recentered: WallPrismRaw = {
        verts: wall.verts.map((v) => [v[0] + centerOffset.x, v[1] + centerOffset.y, v[2] + centerOffset.z]),
        edges: wall.edges,
        faces: wall.faces,
      };
      const geom = wallGeometry(recentered, scale);
      disposables.push(geom);
      scene.add(new THREE.Mesh(geom, wallMaterial));
    }
    wallMaterialRef.current = wallMaterial;

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
      for (const d of disposables) d.dispose();
      capMaterialRef.current = null;
      wallMaterialRef.current = null;
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [specId]);

  useEffect(() => {
    for (const material of [capMaterialRef.current, wallMaterialRef.current]) {
      if (!material) continue;
      material.transparent = mode !== 'solid';
      material.depthWrite = mode === 'solid';
      material.opacity = mode === 'translucent' ? 0.45 : 1;
      material.needsUpdate = true;
    }
  }, [mode, specId]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} aria-label="Draggable 4D duoprism preview" />
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
              border: '1px solid rgba(42,214,201,.4)',
              background: mode === m ? '#1c8f85' : 'rgba(14,18,9,.85)',
              color: mode === m ? '#04140a' : '#2ad6c9',
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
