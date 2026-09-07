'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DELTAHEDRA, type DeltahedronSpec } from '../lib/deltahedra';

const VERTEX_RADIUS = 0.06; // relative to unit edge length
const VERTEX_COLOR = 0xffcc33;

interface VertexUserData {
  vertexId: number;
  degree: number;
}

function buildFaceGeometry(spec: DeltahedronSpec): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const [i, j, k] of spec.faces) {
    positions.push(...spec.vertices[i], ...spec.vertices[j], ...spec.vertices[k]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non-indexed: each vertex is unique per face, so this yields flat shading
  return geometry;
}

function buildEdgeGeometry(spec: DeltahedronSpec): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const [i, j] of spec.edges) {
    positions.push(...spec.vertices[i], ...spec.vertices[j]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Small invisible pickable spheres, one per vertex — raycast targets for hover, not for display. */
function buildVertexGroup(spec: DeltahedronSpec): THREE.Group {
  const group = new THREE.Group();
  for (const connector of spec.connectors) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(VERTEX_RADIUS, 12, 12),
      new THREE.MeshBasicMaterial({
        color: VERTEX_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: false, // stay visible over the shape's own faces once hovered
      }),
    );
    sphere.position.set(...connector.pos);
    sphere.renderOrder = 1;
    sphere.userData = { vertexId: connector.id, degree: connector.degree } satisfies VertexUserData;
    group.add(sphere);
  }
  return group;
}

function disposeVertexGroup(group: THREE.Group) {
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
}

export default function ShapeViewer({ shapeId }: { shapeId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const linesRef = useRef<THREE.LineSegments | null>(null);
  const vertexGroupRef = useRef<THREE.Group | null>(null);
  const hoveredRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const label = labelRef.current;
    if (!container || !label) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(2.4, 1.9, 2.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 4, 5);
    scene.add(dirLight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const clearHover = () => {
      const prev = hoveredRef.current;
      if (prev) {
        (prev.material as THREE.MeshBasicMaterial).opacity = 0;
        prev.scale.setScalar(1);
        hoveredRef.current = null;
      }
      label.style.display = 'none';
    };

    const onPointerMove = (event: PointerEvent) => {
      const group = vertexGroupRef.current;
      if (!group) return;

      const rect = container.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(group.children)[0]?.object as THREE.Mesh | undefined;

      if (hit !== hoveredRef.current) {
        clearHover();
        if (hit) {
          (hit.material as THREE.MeshBasicMaterial).opacity = 1;
          hit.scale.setScalar(1.6);
          hoveredRef.current = hit;
        }
      }

      if (hit) {
        const { vertexId, degree } = hit.userData as VertexUserData;
        label.textContent = `vertex ${vertexId} — capacity ${degree}`;
        label.style.left = `${event.clientX - rect.left + 14}px`;
        label.style.top = `${event.clientY - rect.top + 14}px`;
        label.style.display = 'block';
      }
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', clearHover);

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
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', clearHover);
      controls.dispose();
      container.removeChild(renderer.domElement);
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const spec = DELTAHEDRA[shapeId];
    if (!spec) return;

    hoveredRef.current = null;
    if (labelRef.current) labelRef.current.style.display = 'none';

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
    }
    if (linesRef.current) {
      scene.remove(linesRef.current);
      linesRef.current.geometry.dispose();
      (linesRef.current.material as THREE.Material).dispose();
    }
    if (vertexGroupRef.current) {
      scene.remove(vertexGroupRef.current);
      disposeVertexGroup(vertexGroupRef.current);
    }

    const mesh = new THREE.Mesh(
      buildFaceGeometry(spec),
      new THREE.MeshStandardMaterial({ color: 0x4f8cff, flatShading: true, side: THREE.DoubleSide }),
    );
    scene.add(mesh);
    meshRef.current = mesh;

    const lines = new THREE.LineSegments(
      buildEdgeGeometry(spec),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    scene.add(lines);
    linesRef.current = lines;

    const vertexGroup = buildVertexGroup(spec);
    scene.add(vertexGroup);
    vertexGroupRef.current = vertexGroup;
  }, [shapeId]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={labelRef}
        className="pointer-events-none absolute z-10 hidden rounded bg-black/80 px-2 py-1 text-xs text-white"
      />
    </div>
  );
}
