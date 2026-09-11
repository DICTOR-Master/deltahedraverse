'use client';

/**
 * Stage 7's user-facing operation: "Extend into 4D." Reference-only 3D
 * preview of a FOURD_CAPABLE seed's full radial cell projection (see
 * app/lib/polyhedra/radialProjection.ts) -- unlike duoprism's viewer
 * (available for all 137 shapes, always exact, only ever 2 cells + walls)
 * this is only ever offered for the 4 gold-badge FOURD_CAPABLE shapes,
 * since buildCellComplex only has a verified theta for those, and it
 * renders the WHOLE target 4-polytope's cell complex (8 to 120 cells)
 * under one shared perspective projection, matching a real tesseract/
 * 120-cell schematic diagram: most cells render visibly skewed/scaled
 * relative to each other under the single fixed viewpoint -- correct
 * and expected, not a bug (see radialProjection.ts's own Stage 2 note).
 *
 * Structurally separate from the real, interactive, scene-buildable
 * attach system (ShapeViewer.tsx) -- purely a standalone illustration,
 * mirroring StarShapeViewer.tsx's / DuoprismShapeViewer.tsx's own
 * "never leak into the attach system" convention.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { POLYHEDRA, triangulateFace, type PolyhedronSpec, type Vec3 } from '../../lib/polyhedra';
import { buildRadialProjectionScene } from '../../lib/polyhedra/radialProjection';

const CELL_COLOR = 0xffd54a; // matches the gold "4D-Capable" badge accent used elsewhere in this app
const NEAREST_CELL_COLOR = 0x2ad6c9; // the cell closest to the viewpoint (least |w|) gets a distinct highlight so the "cell-first" structure reads clearly

type ViewMode = 'solid' | 'translucent';
const MODES: ViewMode[] = ['solid', 'translucent'];
const MODE_LABELS: Record<ViewMode, string> = { solid: 'Solid', translucent: 'Translucent' };

export interface RadialProjectionViewerProps {
  specId: string;
  height?: number | string;
}

function cellGeometry(spec: PolyhedronSpec, verts3D: Vec3[], scale: number, offset: THREE.Vector3): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const face of spec.faces) {
    for (const [i, j, k] of triangulateFace(face)) {
      for (const idx of [i, j, k]) {
        const v = verts3D[idx];
        positions.push(v[0] * scale + offset.x, v[1] * scale + offset.y, v[2] * scale + offset.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export default function RadialProjectionViewer({ specId, height = 260 }: RadialProjectionViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const nearestMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const [mode, setMode] = useState<ViewMode>('translucent');
  const [cellCount, setCellCount] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const spec = POLYHEDRA[specId];
    if (!container || !spec) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a10);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 200);
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
    // Deliberately close to zero, not the usual ~1.2: the whole point of
    // this view is seeing the cell-first structure, which for a
    // 120-cell means flying the camera IN PAST the outer cells to see
    // the nested layers -- a real user request, not a default worth
    // guarding against.
    controls.minDistance = 0.02;
    controls.maxDistance = 12;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopAutoRotate);

    const radialScene = buildRadialProjectionScene(spec);
    setCellCount(radialScene.cellsVertices3D.length);

    // Fit-to-view: centroid + max radius across EVERY projected point of
    // EVERY cell (not just the seed's own unprojected vertices) -- the
    // whole point of this view is the perspective-distorted outer cells,
    // so the fit must account for their (larger) projected extent.
    const allPoints = radialScene.cellsVertices3D.flat();
    const cx = allPoints.reduce((s, v) => s + v[0], 0) / allPoints.length;
    const cy = allPoints.reduce((s, v) => s + v[1], 0) / allPoints.length;
    const cz = allPoints.reduce((s, v) => s + v[2], 0) / allPoints.length;
    const maxR = Math.max(...allPoints.map(([x, y, z]) => Math.hypot(x - cx, y - cy, z - cz)), 1e-6);
    const scale = 1 / maxR;
    const centerOffset = new THREE.Vector3(-cx, -cy, -cz).multiplyScalar(scale);

    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
    const cellMaterial = new THREE.MeshStandardMaterial({ color: CELL_COLOR, flatShading: true, side: THREE.DoubleSide });
    const nearestMaterial = new THREE.MeshStandardMaterial({ color: NEAREST_CELL_COLOR, flatShading: true, side: THREE.DoubleSide });
    disposables.push(cellMaterial, nearestMaterial);

    // The "nearest" cell (smallest |w| among the seed's own reference
    // cell and its immediate reflections) reads as the one closest to
    // the 4D viewpoint -- highlighted so the cell-first structure is
    // legible rather than a uniform cloud of identical gold cells.
    let nearestIdx = 0;
    let nearestSpread = Infinity;
    radialScene.cellsVertices3D.forEach((verts, idx) => {
      const spread = Math.max(...verts.map((v) => Math.hypot(v[0] - cx, v[1] - cy, v[2] - cz)));
      if (spread < nearestSpread) {
        nearestSpread = spread;
        nearestIdx = idx;
      }
    });

    radialScene.cellsVertices3D.forEach((verts, idx) => {
      const geom = cellGeometry(spec, verts, scale, centerOffset);
      disposables.push(geom);
      scene.add(new THREE.Mesh(geom, idx === nearestIdx ? nearestMaterial : cellMaterial));
    });
    cellMaterialRef.current = cellMaterial;
    nearestMaterialRef.current = nearestMaterial;

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
      cellMaterialRef.current = null;
      nearestMaterialRef.current = null;
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [specId]);

  useEffect(() => {
    for (const material of [cellMaterialRef.current, nearestMaterialRef.current]) {
      if (!material) continue;
      material.transparent = mode !== 'solid';
      material.depthWrite = mode === 'solid';
      material.opacity = mode === 'translucent' ? 0.35 : 1;
      material.needsUpdate = true;
    }
  }, [mode, specId]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} aria-label="Draggable 4D radial cell projection preview" />
      {cellCount !== null && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            fontSize: 10,
            color: '#ffd54a',
            opacity: 0.85,
            background: 'rgba(10,14,8,.78)',
            border: '1px dashed rgba(255,213,74,.4)',
            borderRadius: 999,
            padding: '4px 10px',
          }}
        >
          {cellCount} cells
        </div>
      )}
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
              border: '1px solid rgba(255,213,74,.4)',
              background: mode === m ? '#a8842f' : 'rgba(14,18,9,.85)',
              color: mode === m ? '#04140a' : '#ffd54a',
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
