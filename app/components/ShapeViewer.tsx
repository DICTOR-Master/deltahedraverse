'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DELTAHEDRA, type DeltahedronSpec } from '../lib/deltahedra';

const VERTEX_RADIUS = 0.06; // relative to unit edge length
const COLOR_FREE = 0xffcc33;
const COLOR_SELECTED = 0x33ff88;
const COLOR_OCCUPIED = 0x777777;

// Which vertex of an *incoming* shape serves as its own connection point.
// Stage 4 doesn't ask the user to choose this — that would need an
// interactive preview, which is what Stage 5's rotate-then-confirm step
// is for. Vertex 0 is an arbitrary but fixed convention for now.
const ATTACH_VERTEX_INDEX = 0;

interface VertexUserData {
  vertexId: number;
  degree: number;
  occupied: boolean;
}

interface PlacedShape {
  object: THREE.Group; // holds mesh + edge lines + vertexGroup; positioned/oriented directly in world space
  vertexGroup: THREE.Group;
}

export interface ShapeViewerHandle {
  /** Clears the scene and places a single instance of `specId` at the origin. */
  reset(specId: string): void;
  /** Attaches a new instance of `specId` to the currently selected target vertex, if any. */
  attach(specId: string): void;
}

export interface ShapeSelection {
  specId: string;
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

/** Small invisible pickable spheres, one per vertex — raycast targets for hover/select, not for display. */
function buildVertexGroup(spec: DeltahedronSpec): THREE.Group {
  const group = new THREE.Group();
  for (const connector of spec.connectors) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(VERTEX_RADIUS, 12, 12),
      new THREE.MeshBasicMaterial({
        color: COLOR_FREE,
        transparent: true,
        opacity: 0,
        depthTest: false, // stay visible over the shape's own faces once highlighted
      }),
    );
    sphere.position.set(...connector.pos);
    sphere.renderOrder = 1;
    sphere.userData = {
      vertexId: connector.id,
      degree: connector.degree,
      occupied: false,
    } satisfies VertexUserData;
    group.add(sphere);
  }
  return group;
}

function buildPlacedShape(spec: DeltahedronSpec): PlacedShape {
  const object = new THREE.Group();
  object.userData = { specId: spec.id };

  const mesh = new THREE.Mesh(
    buildFaceGeometry(spec),
    new THREE.MeshStandardMaterial({ color: 0x4f8cff, flatShading: true, side: THREE.DoubleSide }),
  );
  object.add(mesh);

  const lines = new THREE.LineSegments(
    buildEdgeGeometry(spec),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  object.add(lines);

  const vertexGroup = buildVertexGroup(spec);
  object.add(vertexGroup);

  return { object, vertexGroup };
}

function disposePlacedShape(placed: PlacedShape) {
  placed.object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });
}

/** Paints a vertex sphere according to its current state (free/selected/occupied). */
function paintVertex(sphere: THREE.Mesh, opts: { selected?: boolean; hovered?: boolean }) {
  const data = sphere.userData as VertexUserData;
  const material = sphere.material as THREE.MeshBasicMaterial;
  if (data.occupied) {
    material.color.setHex(COLOR_OCCUPIED);
    material.opacity = 0.6;
    sphere.scale.setScalar(1);
    return;
  }
  if (opts.selected) {
    material.color.setHex(COLOR_SELECTED);
    material.opacity = 1;
    sphere.scale.setScalar(1.6);
    return;
  }
  if (opts.hovered) {
    material.color.setHex(COLOR_FREE);
    material.opacity = 1;
    sphere.scale.setScalar(1.6);
    return;
  }
  material.color.setHex(COLOR_FREE);
  material.opacity = 0;
  sphere.scale.setScalar(1);
}

export default function ShapeViewer({
  initialShapeId,
  onSelectionChange,
  onReady,
}: {
  initialShapeId: string;
  onSelectionChange?: (selection: ShapeSelection | null) => void;
  onReady?: (handle: ShapeViewerHandle) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const placedRef = useRef<PlacedShape[]>([]);
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const selectedRef = useRef<THREE.Mesh | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

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

    const clearSelection = () => {
      if (selectedRef.current) {
        paintVertex(selectedRef.current, {});
        selectedRef.current = null;
      }
      onSelectionChangeRef.current?.(null);
    };

    const resetScene = () => {
      for (const placed of placedRef.current) {
        scene.remove(placed.object);
        disposePlacedShape(placed);
      }
      placedRef.current = [];
      hoveredRef.current = null;
      selectedRef.current = null;
      label.style.display = 'none';
    };

    const placeRoot = (specId: string) => {
      resetScene();
      const spec = DELTAHEDRA[specId];
      if (!spec) return;
      const placed = buildPlacedShape(spec);
      scene.add(placed.object);
      placedRef.current.push(placed);
      onSelectionChangeRef.current?.(null);
    };

    const attach = (specId: string) => {
      const target = selectedRef.current;
      const spec = DELTAHEDRA[specId];
      if (!target || !spec) return;

      scene.updateMatrixWorld(true); // ensure target's world matrix reflects any prior attach

      const targetData = target.userData as VertexUserData;
      const parentObject = target.parent!.parent as THREE.Group; // sphere -> vertexGroup -> shape group

      const targetWorldPos = new THREE.Vector3();
      target.getWorldPosition(targetWorldPos);
      const parentWorldQuat = new THREE.Quaternion();
      parentObject.getWorldQuaternion(parentWorldQuat);
      // Shapes are centered at their own centroid, so a vertex's local position
      // doubles as its local outward direction (per DeltahedronSpec's Connector doc).
      const targetWorldNormal = target.position.clone().normalize().applyQuaternion(parentWorldQuat);

      const placed = buildPlacedShape(spec);
      const attachVertex = spec.vertices[ATTACH_VERTEX_INDEX];
      const attachLocalDir = new THREE.Vector3(...attachVertex).normalize();

      // Rotate the incoming shape's outward direction to point opposite the
      // target's outward normal, so it continues growing away from the
      // existing structure instead of overlapping it.
      const desiredWorldDir = targetWorldNormal.clone().negate();
      const quat = new THREE.Quaternion().setFromUnitVectors(attachLocalDir, desiredWorldDir);
      placed.object.quaternion.copy(quat);

      const rotatedAttachVertex = new THREE.Vector3(...attachVertex).applyQuaternion(quat);
      placed.object.position.copy(targetWorldPos).sub(rotatedAttachVertex);

      scene.add(placed.object);
      placedRef.current.push(placed);

      targetData.occupied = true;
      paintVertex(target, {});

      const newAttachSphere = placed.vertexGroup.children[ATTACH_VERTEX_INDEX] as THREE.Mesh;
      (newAttachSphere.userData as VertexUserData).occupied = true;
      paintVertex(newAttachSphere, {});

      clearSelection();
    };

    placeRoot(initialShapeId);
    onReadyRef.current?.({ reset: placeRoot, attach });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const allVertexSpheres = () => placedRef.current.flatMap((p) => p.vertexGroup.children);

    const clearHover = () => {
      const prev = hoveredRef.current;
      if (prev && prev !== selectedRef.current) {
        paintVertex(prev, {});
      }
      hoveredRef.current = null;
      label.style.display = 'none';
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(allVertexSpheres())[0]?.object as THREE.Mesh | undefined;

      if (hit !== hoveredRef.current) {
        clearHover();
        if (hit) {
          hoveredRef.current = hit;
          if (hit !== selectedRef.current) paintVertex(hit, { hovered: true });
        }
      }

      if (hit) {
        const { vertexId, degree, occupied } = hit.userData as VertexUserData;
        label.textContent = occupied
          ? `vertex ${vertexId} — capacity ${degree} (occupied)`
          : `vertex ${vertexId} — capacity ${degree}`;
        label.style.left = `${event.clientX - rect.left + 14}px`;
        label.style.top = `${event.clientY - rect.top + 14}px`;
        label.style.display = 'block';
      }
    };

    const onClick = () => {
      const hit = hoveredRef.current;

      if (selectedRef.current && selectedRef.current !== hit) {
        paintVertex(selectedRef.current, {});
        selectedRef.current = null;
      }

      if (!hit || (hit.userData as VertexUserData).occupied) {
        selectedRef.current = null;
        onSelectionChangeRef.current?.(null);
        return;
      }

      if (selectedRef.current === hit) {
        selectedRef.current = null;
        onSelectionChangeRef.current?.(null);
        return;
      }

      selectedRef.current = hit;
      paintVertex(hit, { selected: true });
      const specId = (hit.parent!.parent as THREE.Group).userData.specId as string;
      const { vertexId, degree } = hit.userData as VertexUserData;
      onSelectionChangeRef.current?.({ specId, vertexId, degree });
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', clearHover);
    container.addEventListener('click', onClick);

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
      container.removeEventListener('click', onClick);
      resetScene();
      controls.dispose();
      container.removeChild(renderer.domElement);
      renderer.dispose();
      sceneRef.current = null;
    };
    // Intentionally mount-once: `reset`/`attach` are exposed imperatively via
    // onReady, so this component doesn't need to react to prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={labelRef}
        className="pointer-events-none absolute z-10 hidden rounded bg-black/80 px-2 py-1 text-xs text-white"
      />
    </div>
  );
}
