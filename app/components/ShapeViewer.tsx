'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { POLYHEDRA, POLYHEDRON_IDS, type PolyhedronSpec, triangulateFace, buildFaceConnectors } from '../lib/polyhedra';
import { DELTAHEDRA } from '../lib/polyhedra/deltahedra';
import { emptyAssembly, isValidAssembly, type Assembly } from '../lib/assembly';
import { matchRewriteVertices, REWRITE_TARGET } from '../lib/polyhedra/rewrite';
import { collectSubtree, findParentConnection, hasCycle } from '../lib/graph';

const VERTEX_RADIUS = 0.06; // relative to unit edge length
const COLOR_FREE = 0xffcc33;
const COLOR_SELECTED = 0x33ff88;
const COLOR_OCCUPIED = 0x777777;
const COLOR_PENDING = 0xff6688;
const NODE_SELECTED_EMISSIVE = 0x663300;
const NODE_HAS_CAPACITY_EMISSIVE = 0x0d2b1a; // subtle: this node still has a free vertex or face to build from
const TWIST_SENSITIVITY = 0.012; // radians per pixel of horizontal drag, vertex-attach
const FACE_REGISTRATION_DRAG_PX = 40; // pixels of drag per discrete face-registration step

// Which vertex of an *incoming* shape serves as its own connection point for
// vertex-attach. Stage 4/5 don't ask the user to choose this — that would
// need its own interaction step, which isn't part of either stage's spec.
// Vertex 0 is an arbitrary but fixed convention for now.
const ATTACH_VERTEX_INDEX = 0;

export type ViewMode = 'normal' | 'translucent' | 'skeleton';

interface VertexUserData {
  vertexId: number;
  degree: number;
  occupied: boolean;
}

interface ShapeObjectUserData {
  specId: string;
  nodeId: string;
}

interface PlacedShape {
  object: THREE.Group; // holds mesh + edge lines + vertexGroup; positioned/oriented directly in world space
  mesh: THREE.Mesh;
  vertexGroup: THREE.Group;
  triangleToFaceIndex: number[]; // maps a raycast hit's mesh triangle index back to the original polygon face index
  faceOccupied: boolean[]; // one per spec.faces entry — face-attach's counterpart to vertex "occupied"
}

interface PendingVertexAttach {
  kind: 'vertex';
  placed: PlacedShape;
  nodeId: string;
  targetSphere: THREE.Mesh;
  baseQuaternion: THREE.Quaternion; // orientation before twist
  attachLocalDir: THREE.Vector3; // the incoming shape's own local connection axis
  twistAngle: number;
}

interface PendingFaceAttach {
  kind: 'face';
  placed: PlacedShape;
  nodeId: string;
  targetPlaced: PlacedShape;
  targetFaceIndex: number;
  incomingFaceIndex: number;
  baseQuaternion: THREE.Quaternion; // the fully-aligned (registration 0) orientation
  axis: THREE.Vector3; // local face-normal axis to register/twist around
  faceSize: number;
  registration: number; // current discrete rotational registration, 0..faceSize-1
  dragAccumPx: number;
}

type PendingAttach = PendingVertexAttach | PendingFaceAttach;

export interface RewriteResult {
  fromSpecId: string;
  toSpecId: string;
  reattached: number;
  orphaned: number;
}

export interface DeleteResult {
  deletedCount: number;
}

export interface ShapeViewerHandle {
  /** Clears the scene and places a single instance of `specId` at the origin. */
  reset(specId: string): void;
  /** Places `specId` at the currently selected target vertex as a pending (draggable) attach. */
  beginAttach(specId: string): void;
  /** Places `specId` at the currently selected target face as a pending (draggable) face-to-face attach. */
  beginFaceAttach(specId: string): void;
  /** Locks the pending attach (vertex or face) in place. */
  confirmAttach(): void;
  /** Removes the pending attach and frees its target vertex/face again. */
  cancelAttach(): void;
  /** Persists the current assembly graph. Resolves false on failure. */
  save(): Promise<boolean>;
  /** Swaps the currently selected node's shape (D10<->D12 only). Null if nothing eligible is selected. */
  rewriteSelectedNode(): RewriteResult | null;
  /** Removes the currently selected node and its whole subtree. Null if nothing is selected. */
  deleteSelectedNode(): DeleteResult | null;
  /** Sets the render mode (opaque / translucent / skeleton-ish) for every placed shape. */
  setViewMode(mode: ViewMode): void;
}

export interface ShapeSelection {
  specId: string;
  vertexId: number;
  degree: number;
}

export interface NodeSelection {
  nodeId: string;
  specId: string;
  rewriteTarget: string | null;
  faceIndex: number | null;
  faceSize: number | null;
  faceOccupied: boolean;
  /** Spec ids with a matching face size — empty unless faceIndex is set and free. */
  faceAttachOptions: string[];
}

function buildFaceGeometry(spec: PolyhedronSpec): { geometry: THREE.BufferGeometry; triangleToFaceIndex: number[] } {
  const positions: number[] = [];
  const triangleToFaceIndex: number[] = [];
  spec.faces.forEach((face, faceIndex) => {
    for (const [i, j, k] of triangulateFace(face)) {
      positions.push(...spec.vertices[i], ...spec.vertices[j], ...spec.vertices[k]);
      triangleToFaceIndex.push(faceIndex);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non-indexed: each vertex is unique per face, so this yields flat shading
  return { geometry, triangleToFaceIndex };
}

function buildEdgeGeometry(spec: PolyhedronSpec): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const [i, j] of spec.edges) {
    positions.push(...spec.vertices[i], ...spec.vertices[j]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Small invisible pickable spheres, one per vertex — raycast targets for hover/select, not for display. */
function buildVertexGroup(spec: PolyhedronSpec): THREE.Group {
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

// vertexGroup.children[i] always corresponds to spec.connectors[i] (== spec.vertices[i]),
// since buildVertexGroup iterates spec.connectors in order and PolyhedronSpec's own
// buildConnectors() assigns connector.id === its array index.
function buildPlacedShape(spec: PolyhedronSpec, nodeId: string): PlacedShape {
  const object = new THREE.Group();
  object.userData = { specId: spec.id, nodeId } satisfies ShapeObjectUserData;

  const { geometry, triangleToFaceIndex } = buildFaceGeometry(spec);
  const mesh = new THREE.Mesh(
    geometry,
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

  return {
    object,
    mesh,
    vertexGroup,
    triangleToFaceIndex,
    faceOccupied: new Array(spec.faces.length).fill(false),
  };
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

/** Paints a vertex sphere according to its current state (free/selected/occupied/pending). */
function paintVertex(sphere: THREE.Mesh, opts: { selected?: boolean; hovered?: boolean; pending?: boolean }) {
  const data = sphere.userData as VertexUserData;
  const material = sphere.material as THREE.MeshBasicMaterial;
  if (opts.pending) {
    material.color.setHex(COLOR_PENDING);
    material.opacity = 1;
    sphere.scale.setScalar(1.6);
    return;
  }
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

/**
 * A node's body glows faintly while it still has a free vertex or face
 * (pure counting over the same occupied flags the hover tooltip already
 * reports). Selection always wins over the capacity glow.
 */
function applyNodeAppearance(placed: PlacedShape, selected: boolean) {
  const material = placed.mesh.material as THREE.MeshStandardMaterial;
  if (selected) {
    material.emissive.setHex(NODE_SELECTED_EMISSIVE);
    return;
  }
  const hasFreeVertex = placed.vertexGroup.children.some(
    (child) => !((child as THREE.Mesh).userData as VertexUserData).occupied,
  );
  const hasFreeFace = placed.faceOccupied.some((occupied) => !occupied);
  material.emissive.setHex(hasFreeVertex || hasFreeFace ? NODE_HAS_CAPACITY_EMISSIVE : 0x000000);
}

/**
 * Cutaway/inside-view toggle. Skeleton mode keeps the mesh technically
 * visible (opacity near zero) rather than setting `.visible = false` —
 * Three.js's Raycaster skips invisible objects, which would silently break
 * node/face selection while in skeleton mode.
 */
function applyViewMode(placed: PlacedShape, mode: ViewMode) {
  const material = placed.mesh.material as THREE.MeshStandardMaterial;
  material.transparent = mode !== 'normal';
  material.depthWrite = mode === 'normal';
  material.opacity = mode === 'normal' ? 1 : mode === 'translucent' ? 0.35 : 0.04;
}

export default function ShapeViewer({
  initialShapeId,
  onSelectionChange,
  onPendingChange,
  onNodeSelectionChange,
  onCageClosedChange,
  onReady,
}: {
  initialShapeId: string;
  onSelectionChange?: (selection: ShapeSelection | null) => void;
  onPendingChange?: (pending: { specId: string } | null) => void;
  onNodeSelectionChange?: (selection: NodeSelection | null) => void;
  onCageClosedChange?: (closed: boolean) => void;
  onReady?: (handle: ShapeViewerHandle) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const placedRef = useRef<PlacedShape[]>([]);
  const graphRef = useRef<Assembly>(emptyAssembly());
  const hoveredRef = useRef<THREE.Mesh | null>(null);
  const selectedRef = useRef<THREE.Mesh | null>(null);
  const hoveredNodeRef = useRef<PlacedShape | null>(null);
  const selectedNodeRef = useRef<PlacedShape | null>(null);
  const hoveredFaceIndexRef = useRef<number | null>(null);
  const selectedFaceIndexRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingAttach | null>(null);
  const viewModeRef = useRef<ViewMode>('normal');
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onPendingChangeRef = useRef(onPendingChange);
  const onNodeSelectionChangeRef = useRef(onNodeSelectionChange);
  const onCageClosedChangeRef = useRef(onCageClosedChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  useEffect(() => {
    onNodeSelectionChangeRef.current = onNodeSelectionChange;
  }, [onNodeSelectionChange]);

  useEffect(() => {
    onCageClosedChangeRef.current = onCageClosedChange;
  }, [onCageClosedChange]);

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

    const findPlaced = (nodeId: string) =>
      placedRef.current.find((p) => (p.object.userData as ShapeObjectUserData).nodeId === nodeId);

    const placedOwningVertexSphere = (sphere: THREE.Mesh): PlacedShape | undefined => {
      const object = sphere.parent!.parent as THREE.Group;
      return findPlaced((object.userData as ShapeObjectUserData).nodeId);
    };

    const reportCageStatus = () => {
      onCageClosedChangeRef.current?.(hasCycle(graphRef.current));
    };

    const clearSelection = () => {
      if (selectedRef.current) {
        paintVertex(selectedRef.current, {});
        selectedRef.current = null;
      }
      onSelectionChangeRef.current?.(null);
    };

    const clearNodeSelection = () => {
      if (selectedNodeRef.current) {
        applyNodeAppearance(selectedNodeRef.current, false);
        selectedNodeRef.current = null;
      }
      selectedFaceIndexRef.current = null;
      onNodeSelectionChangeRef.current?.(null);
    };

    const cancelAttach = () => {
      const pending = pendingRef.current;
      if (!pending) return;

      scene.remove(pending.placed.object);
      disposePlacedShape(pending.placed);

      if (pending.kind === 'vertex') {
        const targetData = pending.targetSphere.userData as VertexUserData;
        targetData.occupied = false;
        paintVertex(pending.targetSphere, {});
        const parentPlaced = placedOwningVertexSphere(pending.targetSphere);
        if (parentPlaced) applyNodeAppearance(parentPlaced, parentPlaced === selectedNodeRef.current);
      } else {
        pending.targetPlaced.faceOccupied[pending.targetFaceIndex] = false;
        applyNodeAppearance(pending.targetPlaced, pending.targetPlaced === selectedNodeRef.current);
      }

      pendingRef.current = null;
      controls.enabled = true;
      label.style.display = 'none';
      onPendingChangeRef.current?.(null);
    };

    const resetScene = () => {
      cancelAttach();
      for (const placed of placedRef.current) {
        scene.remove(placed.object);
        disposePlacedShape(placed);
      }
      placedRef.current = [];
      graphRef.current = emptyAssembly();
      hoveredRef.current = null;
      selectedRef.current = null;
      hoveredNodeRef.current = null;
      selectedNodeRef.current = null;
      hoveredFaceIndexRef.current = null;
      selectedFaceIndexRef.current = null;
      label.style.display = 'none';
    };

    const placeRoot = (specId: string) => {
      resetScene();
      const spec = POLYHEDRA[specId];
      if (!spec) return;
      const nodeId = crypto.randomUUID();
      const placed = buildPlacedShape(spec, nodeId);
      applyNodeAppearance(placed, false);
      applyViewMode(placed, viewModeRef.current);
      scene.add(placed.object);
      placedRef.current.push(placed);
      graphRef.current = {
        nodes: [
          {
            id: nodeId,
            shape: specId,
            transform: {
              position: placed.object.position.toArray() as [number, number, number],
              quaternion: placed.object.quaternion.toArray() as [number, number, number, number],
            },
          },
        ],
        connections: [],
      };
      onSelectionChangeRef.current?.(null);
      reportCageStatus();
    };

    /** Rebuilds the scene from a previously saved graph — used on load, not on user actions. */
    const loadAssembly = (assembly: Assembly) => {
      resetScene();
      const byNodeId = new Map<string, PlacedShape>();

      for (const node of assembly.nodes) {
        const spec = POLYHEDRA[node.shape];
        if (!spec) continue; // isValidAssembly already guards against this in practice
        const placed = buildPlacedShape(spec, node.id);
        placed.object.position.fromArray(node.transform.position);
        placed.object.quaternion.fromArray(node.transform.quaternion);
        applyViewMode(placed, viewModeRef.current);
        scene.add(placed.object);
        placedRef.current.push(placed);
        byNodeId.set(node.id, placed);
      }

      for (const conn of assembly.connections) {
        if (conn.orphaned) continue; // indices are stale by design — nothing to mark
        const a = byNodeId.get(conn.nodeA);
        const b = byNodeId.get(conn.nodeB);
        if (conn.kind === 'face') {
          if (a) a.faceOccupied[conn.vertexA] = true;
          if (b) b.faceOccupied[conn.vertexB] = true;
          continue;
        }
        const sphereA = a?.vertexGroup.children[conn.vertexA] as THREE.Mesh | undefined;
        const sphereB = b?.vertexGroup.children[conn.vertexB] as THREE.Mesh | undefined;
        if (sphereA) {
          (sphereA.userData as VertexUserData).occupied = true;
          paintVertex(sphereA, {});
        }
        if (sphereB) {
          (sphereB.userData as VertexUserData).occupied = true;
          paintVertex(sphereB, {});
        }
      }

      for (const placed of placedRef.current) applyNodeAppearance(placed, false);

      graphRef.current = assembly;
      onSelectionChangeRef.current?.(null);
      reportCageStatus();
    };

    const beginAttach = (specId: string) => {
      const target = selectedRef.current;
      const spec = POLYHEDRA[specId];
      if (!target || !spec || pendingRef.current) return;

      scene.updateMatrixWorld(true); // ensure target's world matrix reflects any prior attach

      const targetData = target.userData as VertexUserData;
      const parentObject = target.parent!.parent as THREE.Group; // sphere -> vertexGroup -> shape group

      const targetWorldPos = new THREE.Vector3();
      target.getWorldPosition(targetWorldPos);
      const parentWorldQuat = new THREE.Quaternion();
      parentObject.getWorldQuaternion(parentWorldQuat);
      // Shapes are centered at their own centroid, so a vertex's local position
      // doubles as its local outward direction (per PolyhedronSpec's Connector doc).
      const targetWorldNormal = target.position.clone().normalize().applyQuaternion(parentWorldQuat);

      const nodeId = crypto.randomUUID();
      const placed = buildPlacedShape(spec, nodeId);
      const attachVertex = spec.vertices[ATTACH_VERTEX_INDEX];
      const attachLocalDir = new THREE.Vector3(...attachVertex).normalize();

      // Rotate the incoming shape's outward direction to point opposite the
      // target's outward normal, so it continues growing away from the
      // existing structure instead of overlapping it. This leaves exactly
      // one rotational freedom open: twisting around attachLocalDir itself,
      // since that axis maps to itself under any rotation around it.
      const desiredWorldDir = targetWorldNormal.clone().negate();
      const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(attachLocalDir, desiredWorldDir);
      placed.object.quaternion.copy(baseQuaternion);

      const rotatedAttachVertex = new THREE.Vector3(...attachVertex).applyQuaternion(baseQuaternion);
      placed.object.position.copy(targetWorldPos).sub(rotatedAttachVertex);

      applyViewMode(placed, viewModeRef.current);
      scene.add(placed.object);
      applyNodeAppearance(placed, false);

      targetData.occupied = true; // reserved while pending; cancelAttach restores this
      paintVertex(target, { pending: true });

      const newAttachSphere = placed.vertexGroup.children[ATTACH_VERTEX_INDEX] as THREE.Mesh;
      (newAttachSphere.userData as VertexUserData).occupied = true;
      paintVertex(newAttachSphere, { pending: true });

      pendingRef.current = {
        kind: 'vertex',
        placed,
        nodeId,
        targetSphere: target,
        baseQuaternion,
        attachLocalDir,
        twistAngle: 0,
      };
      controls.enabled = false;
      clearSelection();
      onPendingChangeRef.current?.({ specId });
    };

    /**
     * Face-to-face attach: unlike vertex-attach, two congruent regular n-gon
     * faces have no continuously-free rotation once aligned — only n
     * discrete "registrations" (which incoming vertex sits at which target
     * vertex), since rotating a regular n-gon by any multiple of 360/n
     * around its own center maps it onto itself. The exact alignment angle
     * is computed analytically (align incoming's own reference vertex
     * direction to target's, in the shared plane) rather than searched —
     * verified in scripts/verify-face-attach.ts across every matching-size
     * face pair; a first attempt assumed "no extra twist" or "a multiple of
     * 360/n from zero" was always already correct, which turned out false
     * for most pairs (confirmed empirically, not assumed).
     */
    const beginFaceAttach = (specId: string) => {
      const targetPlaced = selectedNodeRef.current;
      const targetFaceIndex = selectedFaceIndexRef.current;
      const spec = POLYHEDRA[specId];
      if (!targetPlaced || targetFaceIndex === null || !spec || pendingRef.current) return;
      if (targetPlaced.faceOccupied[targetFaceIndex]) return;

      const { specId: targetSpecId } = targetPlaced.object.userData as ShapeObjectUserData;
      const targetSpec = POLYHEDRA[targetSpecId];
      const targetFaceSize = targetSpec.faces[targetFaceIndex].length;
      const incomingFaceIndex = spec.faces.findIndex((f) => f.length === targetFaceSize);
      if (incomingFaceIndex === -1) return; // UI should only ever offer compatible shapes

      scene.updateMatrixWorld(true);

      const targetFaceConnector = buildFaceConnectors(targetSpec)[targetFaceIndex];
      const incomingFaceConnector = buildFaceConnectors(spec)[incomingFaceIndex];

      const targetWorldPos = new THREE.Vector3(...targetFaceConnector.pos).applyMatrix4(targetPlaced.object.matrixWorld);
      const targetWorldQuat = new THREE.Quaternion();
      targetPlaced.object.getWorldQuaternion(targetWorldQuat);
      const targetWorldNormal = new THREE.Vector3(...targetFaceConnector.normal).applyQuaternion(targetWorldQuat).normalize();

      const Cg = new THREE.Vector3(...incomingFaceConnector.pos);
      const Ng = new THREE.Vector3(...incomingFaceConnector.normal);

      // Point the incoming face's outward normal opposite the target's, same
      // principle as vertex-attach: incoming grows away from target, faces
      // meeting back-to-back rather than overlapping.
      const desiredWorldDir = targetWorldNormal.clone().negate();
      const baseQuat = new THREE.Quaternion().setFromUnitVectors(Ng, desiredWorldDir);

      // Analytic twist: align incoming's own face-vertex-0 direction to
      // where target's face-vertex-0 needs it, in the shared plane.
      const targetFaceVertexIndices = targetSpec.faces[targetFaceIndex];
      const targetV0World = new THREE.Vector3(...targetSpec.vertices[targetFaceVertexIndices[0]]).applyMatrix4(
        targetPlaced.object.matrixWorld,
      );
      const dTargetWorld = targetV0World.clone().sub(targetWorldPos).normalize();
      const dTargetLocal = dTargetWorld.clone().applyQuaternion(baseQuat.clone().invert());

      const incomingFaceVertexIndices = spec.faces[incomingFaceIndex];
      const incomingV0 = new THREE.Vector3(...spec.vertices[incomingFaceVertexIndices[0]]);
      const dIncomingLocal = incomingV0.clone().sub(Cg).normalize();

      const u = dIncomingLocal.clone();
      const w = new THREE.Vector3().crossVectors(Ng, u).normalize();
      const theta = Math.atan2(dTargetLocal.dot(w), dTargetLocal.dot(u));

      const registrationBaseQuat = baseQuat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Ng, theta));
      const rotatedCg = Cg.clone().applyQuaternion(registrationBaseQuat);
      const position = targetWorldPos.clone().sub(rotatedCg);

      const nodeId = crypto.randomUUID();
      const placed = buildPlacedShape(spec, nodeId);
      placed.object.quaternion.copy(registrationBaseQuat);
      placed.object.position.copy(position);
      applyViewMode(placed, viewModeRef.current);

      scene.add(placed.object);
      applyNodeAppearance(placed, false);

      targetPlaced.faceOccupied[targetFaceIndex] = true; // reserved while pending; cancelAttach restores this
      applyNodeAppearance(targetPlaced, targetPlaced === selectedNodeRef.current);
      placed.faceOccupied[incomingFaceIndex] = true;

      pendingRef.current = {
        kind: 'face',
        placed,
        nodeId,
        targetPlaced,
        targetFaceIndex,
        incomingFaceIndex,
        baseQuaternion: registrationBaseQuat,
        axis: Ng,
        faceSize: targetFaceSize,
        registration: 0,
        dragAccumPx: 0,
      };
      controls.enabled = false;
      clearNodeSelection();
      onPendingChangeRef.current?.({ specId });
    };

    const confirmAttach = () => {
      const pending = pendingRef.current;
      if (!pending) return;

      placedRef.current.push(pending.placed);
      applyNodeAppearance(pending.placed, false);

      if (pending.kind === 'vertex') {
        paintVertex(pending.targetSphere, {});
        const newAttachSphere = pending.placed.vertexGroup.children[ATTACH_VERTEX_INDEX] as THREE.Mesh;
        paintVertex(newAttachSphere, {});

        const parentGroup = pending.targetSphere.parent!.parent as THREE.Group;
        const { nodeId: parentNodeId } = parentGroup.userData as ShapeObjectUserData;
        const { vertexId: targetVertexIndex } = pending.targetSphere.userData as VertexUserData;
        const { specId: newSpecId } = pending.placed.object.userData as ShapeObjectUserData;

        const parentPlaced = findPlaced(parentNodeId);
        if (parentPlaced) applyNodeAppearance(parentPlaced, parentPlaced === selectedNodeRef.current);

        graphRef.current.nodes.push({
          id: pending.nodeId,
          shape: newSpecId,
          transform: {
            position: pending.placed.object.position.toArray() as [number, number, number],
            quaternion: pending.placed.object.quaternion.toArray() as [number, number, number, number],
          },
        });
        graphRef.current.connections.push({
          nodeA: parentNodeId,
          vertexA: targetVertexIndex,
          nodeB: pending.nodeId,
          vertexB: ATTACH_VERTEX_INDEX,
        });
      } else {
        const { nodeId: parentNodeId } = pending.targetPlaced.object.userData as ShapeObjectUserData;
        const { specId: newSpecId } = pending.placed.object.userData as ShapeObjectUserData;
        applyNodeAppearance(pending.targetPlaced, pending.targetPlaced === selectedNodeRef.current);

        graphRef.current.nodes.push({
          id: pending.nodeId,
          shape: newSpecId,
          transform: {
            position: pending.placed.object.position.toArray() as [number, number, number],
            quaternion: pending.placed.object.quaternion.toArray() as [number, number, number, number],
          },
        });
        graphRef.current.connections.push({
          nodeA: parentNodeId,
          vertexA: pending.targetFaceIndex,
          nodeB: pending.nodeId,
          vertexB: pending.incomingFaceIndex,
          kind: 'face',
        });
      }

      pendingRef.current = null;
      controls.enabled = true;
      label.style.display = 'none';
      onPendingChangeRef.current?.(null);
      reportCageStatus();
    };

    /**
     * Stage 7: swap the selected node's mesh between D10 and D12 in place.
     * Existing *vertex* connections to/from this node are re-anchored to
     * the most directionally-similar vertex on the new shape where one
     * exists above the match threshold and isn't already claimed by a
     * better-scoring connection; otherwise the connection is flagged
     * orphaned. Face connections have no analogous re-matching implemented
     * yet, so they're always orphaned on rewrite rather than silently kept
     * with a possibly-wrong face index — surfacing the gap honestly rather
     * than guessing. Crucially, the *other* node in every connection is
     * never touched — its transform, its own occupied state, all untouched
     * — so existing neighbors never move, matched or not.
     */
    const rewriteSelectedNode = (): RewriteResult | null => {
      const node = selectedNodeRef.current;
      if (!node) return null;
      const { specId: oldSpecId, nodeId } = node.object.userData as ShapeObjectUserData;
      const newSpecId = REWRITE_TARGET[oldSpecId];
      if (!newSpecId) return null;
      const newSpec = DELTAHEDRA[newSpecId];

      interface Ref {
        connection: Assembly['connections'][number];
        side: 'A' | 'B';
        oldVertex: number;
      }
      const refs: Ref[] = [];
      let faceOrphaned = 0;
      for (const connection of graphRef.current.connections) {
        if (connection.orphaned) continue;
        const touchesA = connection.nodeA === nodeId;
        const touchesB = connection.nodeB === nodeId;
        if (!touchesA && !touchesB) continue;
        if (connection.kind === 'face') {
          connection.orphaned = true;
          faceOrphaned++;
          continue;
        }
        if (touchesA) refs.push({ connection, side: 'A', oldVertex: connection.vertexA });
        if (touchesB) refs.push({ connection, side: 'B', oldVertex: connection.vertexB });
      }

      const matches = matchRewriteVertices(
        oldSpecId,
        newSpecId,
        refs.map((r) => r.oldVertex),
      );

      // Swap the mesh in place: same node id, same world transform. Nothing
      // else in the scene is touched — no other object's position/quaternion
      // is read or written here.
      const oldPosition = node.object.position.clone();
      const oldQuaternion = node.object.quaternion.clone();
      scene.remove(node.object);
      disposePlacedShape(node);

      const replacement = buildPlacedShape(newSpec, nodeId);
      replacement.object.position.copy(oldPosition);
      replacement.object.quaternion.copy(oldQuaternion);
      applyViewMode(replacement, viewModeRef.current);
      scene.add(replacement.object);

      const index = placedRef.current.indexOf(node);
      if (index !== -1) placedRef.current[index] = replacement;
      else placedRef.current.push(replacement);

      if (hoveredRef.current && (hoveredRef.current.parent as THREE.Group | null)?.parent === node.object) {
        hoveredRef.current = null;
      }
      if (selectedRef.current && (selectedRef.current.parent as THREE.Group | null)?.parent === node.object) {
        selectedRef.current = null;
      }

      const nodeRecord = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (nodeRecord) {
        nodeRecord.shape = newSpecId;
        nodeRecord.transform = {
          position: replacement.object.position.toArray() as [number, number, number],
          quaternion: replacement.object.quaternion.toArray() as [number, number, number, number],
        };
      }

      let reattached = 0;
      let orphaned = faceOrphaned;
      refs.forEach((ref, i) => {
        const newVertex = matches[i];
        if (newVertex === undefined) {
          ref.connection.orphaned = true;
          orphaned++;
          return;
        }
        if (ref.side === 'A') ref.connection.vertexA = newVertex;
        else ref.connection.vertexB = newVertex;
        ref.connection.orphaned = false;

        const sphere = replacement.vertexGroup.children[newVertex] as THREE.Mesh;
        (sphere.userData as VertexUserData).occupied = true;
        paintVertex(sphere, {});
        reattached++;
      });

      applyNodeAppearance(replacement, false);
      clearNodeSelection();
      reportCageStatus();
      return { fromSpecId: oldSpecId, toSpecId: newSpecId, reattached, orphaned };
    };

    /**
     * Stage 8: remove the selected node and cascade to its whole subtree
     * (every node reachable by following nodeA -> nodeB edges from it — see
     * collectSubtree in app/lib/graph.ts). The parent's own vertex or face,
     * if any, is freed again so something new can attach there.
     */
    const deleteSelectedNode = (): DeleteResult | null => {
      const node = selectedNodeRef.current;
      if (!node) return null;
      const { nodeId } = node.object.userData as ShapeObjectUserData;

      const subtreeIds = collectSubtree(graphRef.current.connections, nodeId);
      const parentConn = findParentConnection(graphRef.current.connections, nodeId);

      for (const id of subtreeIds) {
        const placed = findPlaced(id);
        if (!placed) continue;

        scene.remove(placed.object);
        disposePlacedShape(placed);
        const idx = placedRef.current.indexOf(placed);
        if (idx !== -1) placedRef.current.splice(idx, 1);

        if (hoveredNodeRef.current === placed) hoveredNodeRef.current = null;
        if (selectedNodeRef.current === placed) selectedNodeRef.current = null;
        if (hoveredRef.current && placedOwningVertexSphere(hoveredRef.current) === placed) hoveredRef.current = null;
        if (selectedRef.current && placedOwningVertexSphere(selectedRef.current) === placed) selectedRef.current = null;
      }

      graphRef.current.nodes = graphRef.current.nodes.filter((n) => !subtreeIds.has(n.id));
      graphRef.current.connections = graphRef.current.connections.filter(
        (c) => !subtreeIds.has(c.nodeA) && !subtreeIds.has(c.nodeB),
      );

      if (parentConn && !parentConn.orphaned) {
        const parentPlaced = findPlaced(parentConn.nodeA);
        if (parentConn.kind === 'face') {
          if (parentPlaced) parentPlaced.faceOccupied[parentConn.vertexA] = false;
        } else {
          const parentSphere = parentPlaced?.vertexGroup.children[parentConn.vertexA] as THREE.Mesh | undefined;
          if (parentSphere) {
            (parentSphere.userData as VertexUserData).occupied = false;
            paintVertex(parentSphere, {});
          }
        }
        if (parentPlaced) applyNodeAppearance(parentPlaced, parentPlaced === selectedNodeRef.current);
      }

      clearNodeSelection();
      label.style.display = 'none';
      reportCageStatus();
      return { deletedCount: subtreeIds.size };
    };

    const saveAssembly = async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/assemblies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(graphRef.current),
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const setViewMode = (mode: ViewMode) => {
      viewModeRef.current = mode;
      for (const placed of placedRef.current) applyViewMode(placed, mode);
      if (pendingRef.current) applyViewMode(pendingRef.current.placed, mode);
    };

    onReadyRef.current?.({
      reset: placeRoot,
      beginAttach,
      beginFaceAttach,
      confirmAttach,
      cancelAttach,
      save: saveAssembly,
      rewriteSelectedNode,
      deleteSelectedNode,
      setViewMode,
    });

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/assemblies');
        const data: unknown = await res.json();
        if (cancelled) return;
        if (isValidAssembly(data) && data.nodes.length > 0) {
          loadAssembly(data);
          return;
        }
      } catch {
        // no saved assembly (or the fetch failed) — fall through to the default shape
      }
      if (!cancelled) placeRoot(initialShapeId);
    })();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isDragging = false;

    const allVertexSpheres = () => placedRef.current.flatMap((p) => p.vertexGroup.children);
    const allFaceMeshes = () => placedRef.current.map((p) => p.mesh);

    const clearHover = () => {
      const prev = hoveredRef.current;
      if (prev && prev !== selectedRef.current) {
        paintVertex(prev, {});
      }
      hoveredRef.current = null;
      hoveredNodeRef.current = null;
      hoveredFaceIndexRef.current = null;
      label.style.display = 'none';
    };

    const onPointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current;
      const rect = container.getBoundingClientRect();

      if (pending) {
        if (isDragging) {
          if (pending.kind === 'vertex') {
            pending.twistAngle += event.movementX * TWIST_SENSITIVITY;
            const twistQuat = new THREE.Quaternion().setFromAxisAngle(pending.attachLocalDir, pending.twistAngle);
            pending.placed.object.quaternion.copy(pending.baseQuaternion).multiply(twistQuat);

            const degrees = THREE.MathUtils.radToDeg(pending.twistAngle) % 360;
            label.textContent = `twist ${degrees.toFixed(0)}°`;
          } else {
            pending.dragAccumPx += event.movementX;
            while (pending.dragAccumPx >= FACE_REGISTRATION_DRAG_PX) {
              pending.dragAccumPx -= FACE_REGISTRATION_DRAG_PX;
              pending.registration = (pending.registration + 1) % pending.faceSize;
            }
            while (pending.dragAccumPx <= -FACE_REGISTRATION_DRAG_PX) {
              pending.dragAccumPx += FACE_REGISTRATION_DRAG_PX;
              pending.registration = (pending.registration - 1 + pending.faceSize) % pending.faceSize;
            }
            const angle = (pending.registration * 2 * Math.PI) / pending.faceSize;
            const twistQuat = new THREE.Quaternion().setFromAxisAngle(pending.axis, angle);
            pending.placed.object.quaternion.copy(pending.baseQuaternion).multiply(twistQuat);

            label.textContent = `registration ${pending.registration + 1}/${pending.faceSize}`;
          }
          label.style.left = `${event.clientX - rect.left + 14}px`;
          label.style.top = `${event.clientY - rect.top + 14}px`;
          label.style.display = 'block';
        }
        return; // selection/hover raycasting is locked while a piece is pending
      }

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
        hoveredNodeRef.current = null;
        hoveredFaceIndexRef.current = null;
        const { vertexId, degree, occupied } = hit.userData as VertexUserData;
        label.textContent = occupied
          ? `vertex ${vertexId} — capacity ${degree} (occupied)`
          : `vertex ${vertexId} — capacity ${degree}`;
        label.style.left = `${event.clientX - rect.left + 14}px`;
        label.style.top = `${event.clientY - rect.top + 14}px`;
        label.style.display = 'block';
        return;
      }

      // No vertex under the cursor — check for any node body (select for
      // delete, rewrite when D10/D12, or face-attach on the specific
      // triangle's own polygon face).
      const faceHits = raycaster.intersectObjects(allFaceMeshes());
      const faceHit = faceHits[0];
      const node = faceHit ? placedRef.current.find((p) => p.mesh === faceHit.object) : undefined;

      if (node && faceHit) {
        hoveredNodeRef.current = node;
        const faceIndex = typeof faceHit.faceIndex === 'number' ? node.triangleToFaceIndex[faceHit.faceIndex] : null;
        hoveredFaceIndexRef.current = faceIndex;

        const { specId } = node.object.userData as ShapeObjectUserData;
        const rewriteTarget = REWRITE_TARGET[specId];
        const actions = ['delete'];
        if (rewriteTarget) actions.push(`transform → ${rewriteTarget}`);
        if (faceIndex !== null && !node.faceOccupied[faceIndex]) {
          const faceSize = POLYHEDRA[specId].faces[faceIndex].length;
          actions.push(`attach via this ${faceSize}-gon face`);
        }
        label.textContent = `click to select ${specId} node (${actions.join(', ')})`;
        label.style.left = `${event.clientX - rect.left + 14}px`;
        label.style.top = `${event.clientY - rect.top + 14}px`;
        label.style.display = 'block';
      } else {
        hoveredNodeRef.current = null;
        hoveredFaceIndexRef.current = null;
        label.style.display = 'none';
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!pendingRef.current) return;
      isDragging = true;
      container.setPointerCapture(event.pointerId);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        // pointer capture may already be released (e.g. pointercancel) — harmless
      }
    };

    const onClick = () => {
      if (pendingRef.current) return; // confirm/cancel drive pending state, not clicks

      const hit = hoveredRef.current;
      if (hit) {
        clearNodeSelection(); // vertex-select and node-select are mutually exclusive modes

        if (selectedRef.current && selectedRef.current !== hit) {
          paintVertex(selectedRef.current, {});
          selectedRef.current = null;
        }

        if ((hit.userData as VertexUserData).occupied) {
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
        const { specId } = (hit.parent!.parent as THREE.Group).userData as ShapeObjectUserData;
        const { vertexId, degree } = hit.userData as VertexUserData;
        onSelectionChangeRef.current?.({ specId, vertexId, degree });
        return;
      }

      clearSelection();

      const hoveredNode = hoveredNodeRef.current;
      if (selectedNodeRef.current && selectedNodeRef.current !== hoveredNode) {
        clearNodeSelection();
      }

      if (!hoveredNode) {
        clearNodeSelection();
        return;
      }

      if (selectedNodeRef.current === hoveredNode) {
        clearNodeSelection();
        return;
      }

      selectedNodeRef.current = hoveredNode;
      selectedFaceIndexRef.current = hoveredFaceIndexRef.current;
      applyNodeAppearance(hoveredNode, true);

      const { specId, nodeId } = hoveredNode.object.userData as ShapeObjectUserData;
      const faceIndex = selectedFaceIndexRef.current;
      const faceSize = faceIndex !== null ? POLYHEDRA[specId].faces[faceIndex].length : null;
      const faceOccupied = faceIndex !== null ? hoveredNode.faceOccupied[faceIndex] : true;
      const faceAttachOptions =
        faceIndex !== null && !faceOccupied
          ? POLYHEDRON_IDS.filter((id) => POLYHEDRA[id].faces.some((f) => f.length === faceSize))
          : [];

      onNodeSelectionChangeRef.current?.({
        nodeId,
        specId,
        rewriteTarget: REWRITE_TARGET[specId] ?? null,
        faceIndex,
        faceSize,
        faceOccupied,
        faceAttachOptions,
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelAttach();
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', clearHover);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);

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
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', clearHover);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('click', onClick);
      resetScene();
      controls.dispose();
      container.removeChild(renderer.domElement);
      renderer.dispose();
      sceneRef.current = null;
    };
    // Intentionally mount-once: the handle methods are exposed imperatively
    // via onReady, so this component doesn't need to react to prop changes.
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
