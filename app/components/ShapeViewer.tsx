'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DELTAHEDRA, type DeltahedronSpec } from '../lib/deltahedra';
import { emptyAssembly, isValidAssembly, type Assembly } from '../lib/assembly';
import { matchRewriteVertices, REWRITE_TARGET } from '../lib/rewrite';

const VERTEX_RADIUS = 0.06; // relative to unit edge length
const COLOR_FREE = 0xffcc33;
const COLOR_SELECTED = 0x33ff88;
const COLOR_OCCUPIED = 0x777777;
const COLOR_PENDING = 0xff6688;
const NODE_HIGHLIGHT_EMISSIVE = 0x663300;
const TWIST_SENSITIVITY = 0.012; // radians per pixel of horizontal drag

// Which vertex of an *incoming* shape serves as its own connection point.
// Stage 4/5 don't ask the user to choose this — that would need its own
// interaction step, which isn't part of either stage's spec. Vertex 0 is an
// arbitrary but fixed convention for now.
const ATTACH_VERTEX_INDEX = 0;

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
}

interface PendingAttach {
  placed: PlacedShape;
  nodeId: string;
  targetSphere: THREE.Mesh;
  baseQuaternion: THREE.Quaternion; // orientation before twist
  attachLocalDir: THREE.Vector3; // the incoming shape's own local connection axis
  twistAngle: number;
}

export interface RewriteResult {
  fromSpecId: string;
  toSpecId: string;
  reattached: number;
  orphaned: number;
}

export interface ShapeViewerHandle {
  /** Clears the scene and places a single instance of `specId` at the origin. */
  reset(specId: string): void;
  /** Places `specId` at the currently selected target vertex as a pending (draggable) attach. */
  beginAttach(specId: string): void;
  /** Locks the pending attach in place. */
  confirmAttach(): void;
  /** Removes the pending attach and frees its target vertex again. */
  cancelAttach(): void;
  /** Persists the current assembly graph. Resolves false on failure. */
  save(): Promise<boolean>;
  /** Swaps the currently selected node's shape (D10<->D12 only). Null if nothing eligible is selected. */
  rewriteSelectedNode(): RewriteResult | null;
}

export interface ShapeSelection {
  specId: string;
  vertexId: number;
  degree: number;
}

export interface NodeSelection {
  nodeId: string;
  specId: string;
  rewriteTarget: string;
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

// vertexGroup.children[i] always corresponds to spec.connectors[i] (== spec.vertices[i]),
// since buildVertexGroup iterates spec.connectors in order and DeltahedronSpec's own
// buildConnectors() assigns connector.id === its array index.
function buildPlacedShape(spec: DeltahedronSpec, nodeId: string): PlacedShape {
  const object = new THREE.Group();
  object.userData = { specId: spec.id, nodeId } satisfies ShapeObjectUserData;

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

  return { object, mesh, vertexGroup };
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

function setNodeHighlighted(placed: PlacedShape, highlighted: boolean) {
  (placed.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(highlighted ? NODE_HIGHLIGHT_EMISSIVE : 0x000000);
}

export default function ShapeViewer({
  initialShapeId,
  onSelectionChange,
  onPendingChange,
  onNodeSelectionChange,
  onReady,
}: {
  initialShapeId: string;
  onSelectionChange?: (selection: ShapeSelection | null) => void;
  onPendingChange?: (pending: { specId: string } | null) => void;
  onNodeSelectionChange?: (selection: NodeSelection | null) => void;
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
  const pendingRef = useRef<PendingAttach | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onPendingChangeRef = useRef(onPendingChange);
  const onNodeSelectionChangeRef = useRef(onNodeSelectionChange);
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

    const clearNodeSelection = () => {
      if (selectedNodeRef.current) {
        setNodeHighlighted(selectedNodeRef.current, false);
        selectedNodeRef.current = null;
      }
      onNodeSelectionChangeRef.current?.(null);
    };

    const cancelAttach = () => {
      const pending = pendingRef.current;
      if (!pending) return;

      scene.remove(pending.placed.object);
      disposePlacedShape(pending.placed);

      const targetData = pending.targetSphere.userData as VertexUserData;
      targetData.occupied = false;
      paintVertex(pending.targetSphere, {});

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
      label.style.display = 'none';
    };

    const placeRoot = (specId: string) => {
      resetScene();
      const spec = DELTAHEDRA[specId];
      if (!spec) return;
      const nodeId = crypto.randomUUID();
      const placed = buildPlacedShape(spec, nodeId);
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
    };

    /** Rebuilds the scene from a previously saved graph — used on load, not on user actions. */
    const loadAssembly = (assembly: Assembly) => {
      resetScene();
      const byNodeId = new Map<string, PlacedShape>();

      for (const node of assembly.nodes) {
        const spec = DELTAHEDRA[node.shape];
        if (!spec) continue; // isValidAssembly already guards against this in practice
        const placed = buildPlacedShape(spec, node.id);
        placed.object.position.fromArray(node.transform.position);
        placed.object.quaternion.fromArray(node.transform.quaternion);
        scene.add(placed.object);
        placedRef.current.push(placed);
        byNodeId.set(node.id, placed);
      }

      for (const conn of assembly.connections) {
        if (conn.orphaned) continue; // vertex indices are stale by design — nothing to mark
        const a = byNodeId.get(conn.nodeA);
        const b = byNodeId.get(conn.nodeB);
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

      graphRef.current = assembly;
      onSelectionChangeRef.current?.(null);
    };

    const beginAttach = (specId: string) => {
      const target = selectedRef.current;
      const spec = DELTAHEDRA[specId];
      if (!target || !spec || pendingRef.current) return;

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

      scene.add(placed.object);

      targetData.occupied = true; // reserved while pending; cancelAttach restores this
      paintVertex(target, { pending: true });

      const newAttachSphere = placed.vertexGroup.children[ATTACH_VERTEX_INDEX] as THREE.Mesh;
      (newAttachSphere.userData as VertexUserData).occupied = true;
      paintVertex(newAttachSphere, { pending: true });

      pendingRef.current = { placed, nodeId, targetSphere: target, baseQuaternion, attachLocalDir, twistAngle: 0 };
      controls.enabled = false;
      clearSelection();
      onPendingChangeRef.current?.({ specId });
    };

    const confirmAttach = () => {
      const pending = pendingRef.current;
      if (!pending) return;

      placedRef.current.push(pending.placed);
      paintVertex(pending.targetSphere, {});
      const newAttachSphere = pending.placed.vertexGroup.children[ATTACH_VERTEX_INDEX] as THREE.Mesh;
      paintVertex(newAttachSphere, {});

      const parentGroup = pending.targetSphere.parent!.parent as THREE.Group;
      const { nodeId: parentNodeId } = parentGroup.userData as ShapeObjectUserData;
      const { vertexId: targetVertexIndex } = pending.targetSphere.userData as VertexUserData;
      const { specId: newSpecId } = pending.placed.object.userData as ShapeObjectUserData;

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

      pendingRef.current = null;
      controls.enabled = true;
      label.style.display = 'none';
      onPendingChangeRef.current?.(null);
    };

    /**
     * Stage 7: swap the selected node's mesh between D10 and D12 in place.
     * Existing connections to/from this node are re-anchored to the most
     * directionally-similar vertex on the new shape where one exists above
     * the match threshold and isn't already claimed by a better-scoring
     * connection; otherwise the connection is flagged orphaned. Crucially,
     * the *other* node in every such connection is never touched — its
     * transform, its own vertex's occupied state, all untouched — so
     * existing neighbors never move, matched or not.
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
      for (const connection of graphRef.current.connections) {
        if (connection.orphaned) continue;
        if (connection.nodeA === nodeId) refs.push({ connection, side: 'A', oldVertex: connection.vertexA });
        if (connection.nodeB === nodeId) refs.push({ connection, side: 'B', oldVertex: connection.vertexB });
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
      let orphaned = 0;
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

      clearNodeSelection();
      return { fromSpecId: oldSpecId, toSpecId: newSpecId, reattached, orphaned };
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

    onReadyRef.current?.({
      reset: placeRoot,
      beginAttach,
      confirmAttach,
      cancelAttach,
      save: saveAssembly,
      rewriteSelectedNode,
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
      label.style.display = 'none';
    };

    const onPointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current;
      const rect = container.getBoundingClientRect();

      if (pending) {
        if (isDragging) {
          pending.twistAngle += event.movementX * TWIST_SENSITIVITY;
          const twistQuat = new THREE.Quaternion().setFromAxisAngle(pending.attachLocalDir, pending.twistAngle);
          pending.placed.object.quaternion.copy(pending.baseQuaternion).multiply(twistQuat);

          const degrees = THREE.MathUtils.radToDeg(pending.twistAngle) % 360;
          label.textContent = `twist ${degrees.toFixed(0)}°`;
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
        const { vertexId, degree, occupied } = hit.userData as VertexUserData;
        label.textContent = occupied
          ? `vertex ${vertexId} — capacity ${degree} (occupied)`
          : `vertex ${vertexId} — capacity ${degree}`;
        label.style.left = `${event.clientX - rect.left + 14}px`;
        label.style.top = `${event.clientY - rect.top + 14}px`;
        label.style.display = 'block';
        return;
      }

      // No vertex under the cursor — check for a rewritable (D10/D12) node body.
      const faceHit = raycaster.intersectObjects(allFaceMeshes())[0]?.object as THREE.Mesh | undefined;
      const node = faceHit ? placedRef.current.find((p) => p.mesh === faceHit) : undefined;
      const specId = node ? (node.object.userData as ShapeObjectUserData).specId : undefined;
      const rewriteTarget = specId ? REWRITE_TARGET[specId] : undefined;

      if (node && rewriteTarget) {
        hoveredNodeRef.current = node;
        label.textContent = `click to transform ${specId} → ${rewriteTarget}`;
        label.style.left = `${event.clientX - rect.left + 14}px`;
        label.style.top = `${event.clientY - rect.top + 14}px`;
        label.style.display = 'block';
      } else {
        hoveredNodeRef.current = null;
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
        clearNodeSelection(); // vertex-select and node-rewrite-select are mutually exclusive modes

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
      setNodeHighlighted(hoveredNode, true);
      const { specId, nodeId } = hoveredNode.object.userData as ShapeObjectUserData;
      onNodeSelectionChangeRef.current?.({ nodeId, specId, rewriteTarget: REWRITE_TARGET[specId] });
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
