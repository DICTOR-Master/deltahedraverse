'use client';

/**
 * Shared wireframe preview renderer for the ShapeBrowser -- used by grid
 * cards (Search/Home/Favorites, 20-40 visible at once) and the larger
 * drawer/Compare previews alike.
 *
 * Deliberately plain 2D <canvas> orthographic projection, NOT Three.js/
 * WebGL: no react-three-fiber exists in this project, and each of the
 * three existing 3D components (ShapeViewer, PolyhedralWheel,
 * CornerHudWheel) already stands up its own full THREE.Scene/
 * WebGLRenderer. A Search grid showing dozens of cards at once would need
 * dozens of simultaneous WebGL contexts, well past the ~8-16 concurrent
 * contexts most browsers allow. Previews are pure wireframes (no
 * lighting/materials needed), so a manual rotation-matrix + orthographic
 * projection of the REAL spec.vertices/edges, stroked onto a 2D canvas,
 * has no context-limit ceiling and is driven by one shared module-level
 * requestAnimationFrame scheduler ticking every mounted instance --
 * bounding total per-frame cost regardless of how many cards are visible.
 */

import { useEffect, useRef, useState } from 'react';
import { getAnySpec } from '../../lib/polyhedra/lookup';

// Matches PolyhedralWheel's existing green identity (HUD_METAL_HEX /
// SCRIPT_COLOR in PolyhedralWheel.tsx) so previews read as part of the same
// visual system as the wheel/browser chrome. Note this is a different accent
// from the corner HUD medallion itself (CornerHudWheel.tsx), which is
// silver (HUD_SILVER_HEX) -- "HUD_METAL_HEX" here is a legacy name from
// before that split, not a claim both are the same color. Phase 2's theme
// system will make this swappable.
const LINE_COLOR = '#47cc24';
const LINE_COLOR_DIM = 'rgba(71, 204, 36, 0.35)';

type DrawFn = (nowMs: number) => void;

// One shared rAF loop for every mounted ShapePreview, so N previews cost
// one scheduled callback per frame, not N.
const scheduler = (() => {
  const callbacks = new Set<DrawFn>();
  let frameId: number | null = null;
  const tick = (now: number) => {
    callbacks.forEach((cb) => cb(now));
    frameId = callbacks.size > 0 ? requestAnimationFrame(tick) : null;
  };
  return {
    register(cb: DrawFn) {
      callbacks.add(cb);
      if (frameId === null) frameId = requestAnimationFrame(tick);
    },
    unregister(cb: DrawFn) {
      callbacks.delete(cb);
    },
  };
})();

function rotateY([x, y, z]: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotateX([x, y, z]: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

export interface ShapePreviewProps {
  specId: string;
  size: number;
  spin?: boolean;
}

export default function ShapePreview({ specId, size, spin = false }: ShapePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // A per-instance phase offset so multiple static cards don't all freeze
  // at the exact same angle -- a purely cosmetic touch. useState's lazy
  // initializer (not a bare useRef(Math.random())) is the React-sanctioned
  // place for an impure one-time-per-mount value like this.
  const [phase] = useState(() => Math.random() * Math.PI * 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    const spec = getAnySpec(specId);
    if (!canvas || !spec) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Normalize vertices to fit the canvas: center on centroid, scale by
    // the largest radius so every shape (a 4-vertex tetrahedron or a
    // 120-vertex disdyakis triacontahedron) fills the frame consistently.
    const verts = spec.vertices;
    const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
    const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
    const cz = verts.reduce((s, v) => s + v[2], 0) / verts.length;
    const centered: [number, number, number][] = verts.map((v) => [v[0] - cx, v[1] - cy, v[2] - cz]);
    const maxR = Math.max(...centered.map(([x, y, z]) => Math.sqrt(x * x + y * y + z * z)), 1e-6);
    const scale = (size * dpr * 0.36) / maxR;

    let angle = phase;
    const tilt = 0.5; // fixed gentle tilt, same for every preview

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const half = (size * dpr) / 2;
      const rotated = centered.map((v) => rotateX(rotateY(v, angle), tilt));

      // Depth-based line alpha for a cheap pseudo-3D read (nearer edges
      // brighter), sorted so nearer edges draw last (simple painter's algorithm).
      const zs = rotated.map(([, , z]) => z);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const zRange = Math.max(maxZ - minZ, 1e-6);

      const edgesByDepth = [...spec.edges]
        .map(([a, b]) => ({ a, b, avgZ: (zs[a] + zs[b]) / 2 }))
        .sort((e1, e2) => e1.avgZ - e2.avgZ);

      for (const { a, b, avgZ } of edgesByDepth) {
        const [ax, ay] = rotated[a];
        const [bx, by] = rotated[b];
        const depthT = (avgZ - minZ) / zRange; // 0 (far) .. 1 (near)
        ctx.strokeStyle = depthT > 0.5 ? LINE_COLOR : LINE_COLOR_DIM;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        ctx.moveTo(half + ax * scale, half - ay * scale);
        ctx.lineTo(half + bx * scale, half - by * scale);
        ctx.stroke();
      }
    };

    if (spin) {
      const onFrame = () => {
        angle += 0.008;
        draw();
      };
      scheduler.register(onFrame);
      return () => scheduler.unregister(onFrame);
    }
    draw();
    return undefined;
  }, [specId, size, spin, phase]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block' }}
      aria-hidden="true"
    />
  );
}
