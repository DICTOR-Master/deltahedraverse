'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  POLYHEDRA,
  POLYHEDRON_IDS,
  type PolyhedronSpec,
  triangulateFace,
  buildFaceConnectors,
  facesCongruent,
  faceRotationalSymmetry,
} from '../lib/polyhedra';
import { DELTAHEDRA } from '../lib/polyhedra/deltahedra';
import { emptyAssembly, isValidAssembly, type Assembly } from '../lib/assembly';
import { matchRewriteVertices, REWRITE_TARGET } from '../lib/polyhedra/rewrite';
import { collectSubtree, findParentConnection, hasCycle } from '../lib/graph';
import { FOURD_CAPABLE_IDS } from '../lib/polyhedra/fourD';
import { edgeClosingCorrection } from '../lib/polyhedra/fold4';
import { buildWallPrism, duoprismBuildDepth } from '../lib/polyhedra/duoprism';

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
  object: THREE.Group; // holds foldGroup + vertexGroup; positioned/oriented directly in world space
  // 4D extension: mesh + edge lines live one level deeper, inside this
  // group, so a fold4-attached node's real closing rotation (see
  // recomputeAllFolds below) can be applied as this group's own local
  // matrix without ever touching `object`'s own position/quaternion
  // (which stays the ordinary flush pose the graph itself stores).
  // vertexGroup deliberately stays a DIRECT child of `object`, a sibling
  // of foldGroup rather than nested inside it -- vertex-attach code
  // elsewhere assumes exactly `sphere.parent.parent === object` (see
  // placedOwningVertexSphere/beginAttach), and a folded node can never be
  // the target of a NEW vertex-attach in this pass anyway (fold4 is
  // face-only). For every node with no fold4 sibling relationship,
  // foldGroup's matrix is simply identity and this is invisible.
  foldGroup: THREE.Group;
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
  // The face's OWN rotational symmetry order (faceRotationalSymmetry), not
  // its vertex count — only the same for a regular n-gon. A rhombus has 4
  // vertices but only 2 valid registrations (2-fold symmetry: its interior
  // angles alternate); most Catalan-solid faces have just 1 (no rotational
  // symmetry beyond identity). See docs/catalan-solids-spec.md.
  registrationCount: number;
  registration: number; // current discrete rotational registration, 0..registrationCount-1
  dragAccumPx: number;
  // 4D extension, Stage D, trigger point 1: set only when beginFaceAttach
  // was explicitly called with fold4 requested AND actually eligible
  // (self-attach of a FOURD_CAPABLE_IDS shape) -- confirmAttach reads
  // this to decide whether to tag the resulting connection `fold4: true`
  // and register it for the fold slider.
  fold4: boolean;
}

interface PendingDuoprismAttach {
  kind: 'duoprism';
  placed: PlacedShape;
  nodeId: string;
  targetPlaced: PlacedShape;
  targetFaceIndex: number;
  // The connecting wall-prism cell -- built once at begin time (its own
  // geometry never changes before confirm, since there's no registration/
  // twist step to drag through unlike ordinary/fold4 face-attach) and
  // added to the scene as a plain extra mesh, not part of either node's
  // own PlacedShape. Removed on cancel, kept (and re-derived on load) on
  // confirm -- see duoprismMeshesRef.
  wallMesh: THREE.Mesh;
}

type PendingAttach = PendingVertexAttach | PendingFaceAttach | PendingDuoprismAttach;

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
  /**
   * Places `specId` at the currently selected target face as a pending
   * (draggable) face-to-face attach. `fold4` requests the real 4D fold
   * (see fold4.ts) instead of an ordinary flush join -- silently ignored
   * (falls back to an ordinary attach) unless `specId` matches the
   * target's own shape and that shape is FOURD_CAPABLE_IDS-eligible;
   * `isValidAssembly` is the actual authority this defers to, this is
   * just the UI-facing request.
   */
  beginFaceAttach(specId: string, fold4?: boolean): void;
  /**
   * Places a same-shape, identical-orientation TRANSLATED copy at the
   * currently selected target face, connected by a real 3D wall-prism
   * cell (see duoprism.ts) -- the 4D Prism / duoprism construction.
   * Unlike beginFaceAttach, there is no shape choice and no registration/
   * twist step: the incoming shape and orientation are entirely
   * determined by the target (silently no-ops if nothing selected, or
   * the target isn't FOURD_CAPABLE_IDS-eligible -- `isValidAssembly` is
   * the actual authority this defers to).
   */
  beginDuoprismAttach(): void;
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
  /**
   * Removes the single most recently CONFIRMED attach (vertex or face),
   * and whatever's been built on top of it since, if anything. Null if
   * there's nothing to undo (nothing confirmed yet this session, or the
   * last one was already undone/deleted/reset past). Single-level only
   * -- calling it again immediately after a successful undo returns null,
   * not a second step back; a fresh confirmAttach/beginFaceAttach cycle
   * is what re-arms it.
   */
  undo(): DeleteResult | null;
  /** The current assembly graph, exactly as saved -- for client-side export (JSON download), not persistence. */
  getAssembly(): Assembly;
  /** Sets the render mode (opaque / translucent / skeleton-ish) for every placed shape. */
  setViewMode(mode: ViewMode): void;
  /**
   * The 4D fold slider position, 0 (pure 3D projection -- the real
   * geometric separation gap) to 1 (pure 4D -- flush, matching the
   * ordinary stored pose). Only ever visibly affects nodes with an
   * incoming fold4 connection; a no-op otherwise. See
   * onFoldConnectionsChange for when the UI should even show this control.
   */
  setFoldAmount(t: number): void;
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
  /**
   * 4D extension, Stage D, trigger point 1: true iff this node's own
   * shape is FOURD_CAPABLE_IDS-eligible AND the selected face is free --
   * the UI's signal for whether to additionally offer "attach via 4D
   * fold" (self-attach only) alongside the ordinary face-attach picker,
   * never as a separate always-visible control.
   */
  faceFold4Eligible: boolean;
  /**
   * Same eligibility condition as faceFold4Eligible (this node's own
   * shape is FOURD_CAPABLE_IDS-eligible AND the selected face is free) --
   * the UI's signal for whether to additionally offer "Attach via
   * Duoprism…" alongside the ordinary face-attach and 4D-fold options.
   * Always true/false together with faceFold4Eligible for the 4
   * qualifying shapes; kept as its own field (not reusing
   * faceFold4Eligible directly) so the two features can diverge in
   * scope later without an implicit coupling.
   */
  faceDuoprismEligible: boolean;
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
    // side: FrontSide here matches 'normal' mode's own value (applyViewMode
    // is always called immediately after buildPlacedShape and would
    // overwrite this regardless -- see its own comment for why side is
    // mode-dependent, not a fixed DoubleSide).
    // Matches the brand green used consistently everywhere else (logo,
    // PolyhedralWheel, CornerHudWheel, WelcomeOverlay, header) instead of
    // a leftover generic blue -- applies uniformly across every view
    // mode (Solid/Translucent/Inside) since applyViewMode only ever
    // touches opacity/side/depthWrite, never the base color itself.
    new THREE.MeshStandardMaterial({ color: 0x47cc24, flatShading: true, side: THREE.FrontSide }),
  );

  // See PlacedShape's own doc comment for why mesh + lines live inside
  // this extra group rather than directly under `object`.
  const foldGroup = new THREE.Group();
  foldGroup.add(mesh);

  const lines = new THREE.LineSegments(
    buildEdgeGeometry(spec),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  foldGroup.add(lines);
  object.add(foldGroup);

  const vertexGroup = buildVertexGroup(spec);
  object.add(vertexGroup);

  return {
    object,
    foldGroup,
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
 *
 * side is mode-dependent, not a fixed DoubleSide: real bug found live
 * ("a triangle not quite covering a triangle") -- face-attach glues two
 * faces together facing exactly opposite directions (deliberately, so
 * pieces meet back-to-back rather than overlapping -- see
 * beginFaceAttach's own comment), and once joined those two coincident
 * triangles are now both genuinely INTERNAL to the assembly, never meant
 * to be independently visible from outside. With DoubleSide, both still
 * rendered anyway -- two exactly-coincident, oppositely-wound triangles
 * both competing for the same pixels is a textbook z-fighting setup,
 * confirmed NOT a data/position bug first (a chained multi-attach
 * simulation, including a snub disphenoid specifically, measured
 * coincidence error at machine-epsilon/~1e-16 in every case tried).
 * FrontSide for normal/Solid view fixes this by construction (the
 * internal, away-facing triangle of each piece is simply never
 * rasterized at all, not just less likely to conflict) and is also the
 * geometrically correct choice for an opaque solid regardless. Kept
 * DoubleSide for Translucent/Inside view, where seeing the far/interior
 * surface through the near one is the whole point of those modes, not
 * an oversight to also fix.
 */
function applyViewMode(placed: PlacedShape, mode: ViewMode) {
  const material = placed.mesh.material as THREE.MeshStandardMaterial;
  material.transparent = mode !== 'normal';
  material.depthWrite = mode === 'normal';
  material.opacity = mode === 'normal' ? 1 : mode === 'translucent' ? 0.35 : 0.04;
  material.side = mode === 'normal' ? THREE.FrontSide : THREE.DoubleSide;
  material.needsUpdate = true;
}

export default function ShapeViewer({
  initialShapeId,
  onSelectionChange,
  onPendingChange,
  onNodeSelectionChange,
  onCageClosedChange,
  onCanUndoChange,
  onFoldConnectionsChange,
  onReady,
}: {
  initialShapeId: string;
  onSelectionChange?: (selection: ShapeSelection | null) => void;
  onPendingChange?: (pending: { specId: string; fold4?: boolean; duoprism?: boolean } | null) => void;
  onNodeSelectionChange?: (selection: NodeSelection | null) => void;
  onCageClosedChange?: (closed: boolean) => void;
  onCanUndoChange?: (canUndo: boolean) => void;
  /**
   * Fires whenever the current assembly's own count of real fold4
   * connections crosses the zero/nonzero boundary -- the UI's own signal
   * for whether the 4D fold slider should be visible at all (trigger
   * point 2 of the contextual design: the slider only ever appears once
   * at least one fold4 attachment genuinely exists, never as a permanent
   * control).
   */
  onFoldConnectionsChange?: (hasFoldConnections: boolean) => void;
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
  // The single most recently CONFIRMED attach's node id -- see undo()'s
  // own doc comment on ShapeViewerHandle for the exact single-level
  // semantics. Cleared on reset, on undo itself, and whenever that
  // specific node gets removed some other way (an explicit delete
  // covering it).
  const lastAddedNodeIdRef = useRef<string | null>(null);
  // 4D extension. foldAmountRef is the slider's own `t`: 0 = raw/ordinary
  // 3D (every fold4-attached sibling sits at its own real, independent
  // flush pose -- the actual geometric gap between siblings sharing an
  // edge is fully visible, matching a rigid physical construction), 1 =
  // fully closed (each sibling rotated to meet its neighbor, matching
  // the true 4D structure where the gap doesn't exist). Starts at 0 so a
  // freshly confirmed fold4 attach looks exactly like an ordinary flush
  // attach (its real geometric consequences visible) until the player
  // drags the slider toward 4D themselves; reset back to 0 whenever the
  // assembly's last fold4 connection is removed. See
  // recomputeAllFolds's own doc comment for how `t` turns into actual
  // per-node rotations, recomputed fresh from the current graph on every
  // change rather than incrementally cached (simpler and correct even
  // when a new sibling's arrival changes an EXISTING node's own
  // correction, which incremental per-node registration got wrong).
  const foldAmountRef = useRef<number>(0);
  const hasFoldConnectionsRef = useRef<boolean>(false);
  // Duoprism wall-prism meshes, keyed by their own CHILD node's id (see
  // confirmAttach's own duoprism branch) -- plain extra scene meshes,
  // never part of either node's own PlacedShape, since a wall-prism
  // isn't itself an assembly node.
  const duoprismMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const onFoldConnectionsChangeRef = useRef(onFoldConnectionsChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onPendingChangeRef = useRef(onPendingChange);
  const onNodeSelectionChangeRef = useRef(onNodeSelectionChange);
  const onCageClosedChangeRef = useRef(onCageClosedChange);
  const onCanUndoChangeRef = useRef(onCanUndoChange);
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
    onCanUndoChangeRef.current = onCanUndoChange;
  }, [onCanUndoChange]);

  useEffect(() => {
    onFoldConnectionsChangeRef.current = onFoldConnectionsChange;
  }, [onFoldConnectionsChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    const label = labelRef.current;
    if (!container || !label) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a10);
    sceneRef.current = scene;

    // Starry background: a static field of small points scattered on a
    // large sphere shell well outside any shape (shapes stay within a
    // handful of units of the origin; the camera's own far plane is 100).
    // Purely decorative, zero per-frame cost -- one static BufferGeometry
    // added once at scene setup, not touched by the render loop.
    const STAR_COUNT = 800;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 40 + Math.random() * 20;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const starfield = new THREE.Points(starGeometry, starMaterial);
    scene.add(starfield);

    // Face-hover highlight: a single shared overlay mesh showing exactly
    // which triangle is currently targeted, distinct from
    // applyNodeAppearance's own whole-shape emissive glow. Real gap found
    // live -- with only a whole-shape glow (correct for "this node has
    // capacity", never meant to be face-specific) and a text tooltip,
    // there was no way to actually SEE which of a many-faced shape's
    // triangles (e.g. all 12 on a snub disphenoid) was about to be
    // attached to -- it happened to look reasonable on a 4-faced
    // tetrahedron (each face is a large fraction of the whole shape) but
    // read as "the whole shape lighting up"/"attaching randomly" on
    // anything with more, smaller faces. Rebuilt per-hover to match
    // whichever face is targeted (geometry is cheap -- at most a handful
    // of triangles), parented under the hovered node's own object so it
    // inherits that node's transform automatically.
    const faceHighlightMaterial = new THREE.MeshBasicMaterial({
      color: COLOR_FREE,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: false, // always drawn on top, never z-fights the shape's own face underneath
    });
    const faceHighlightMesh = new THREE.Mesh(new THREE.BufferGeometry(), faceHighlightMaterial);
    faceHighlightMesh.renderOrder = 999; // draw after everything else, pairs with depthTest:false above
    faceHighlightMesh.visible = false;
    scene.add(faceHighlightMesh);

    const showFaceHighlight = (node: PlacedShape, faceIndex: number) => {
      const spec = POLYHEDRA[(node.object.userData as ShapeObjectUserData).specId];
      const positions: number[] = [];
      for (const [a, b, c] of triangulateFace(spec.faces[faceIndex])) {
        positions.push(...spec.vertices[a], ...spec.vertices[b], ...spec.vertices[c]);
      }
      faceHighlightMesh.geometry.dispose();
      faceHighlightMesh.geometry = new THREE.BufferGeometry();
      faceHighlightMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      faceHighlightMesh.geometry.computeVertexNormals();
      node.object.updateMatrixWorld(true);
      // Through the node's own foldGroup, not `object` directly -- matches
      // beginFaceAttach's own fix (see its comment): a fold4 node's real
      // rendered position can differ from its outer object's unfolded
      // baseline once the slider is off 0, and the highlight should track
      // whichever one is actually clickable/visible.
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      node.foldGroup.matrixWorld.decompose(pos, quat, scl);
      faceHighlightMesh.position.copy(pos);
      faceHighlightMesh.quaternion.copy(quat);
      faceHighlightMesh.scale.copy(scl);
      faceHighlightMesh.visible = true;
    };
    const hideFaceHighlight = () => {
      faceHighlightMesh.visible = false;
    };

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

    /** The OTHER face of `spec` (besides `faceIndex`) that also borders the edge (vi,vj) of `faceIndex`'s own cycle, or null (shouldn't happen for a valid manifold solid). */
    const otherFaceAcrossEdge = (spec: PolyhedronSpec, faceIndex: number, vi: number, vj: number): number | null => {
      for (let f = 0; f < spec.faces.length; f++) {
        if (f === faceIndex) continue;
        const face = spec.faces[f];
        for (let k = 0; k < face.length; k++) {
          const a = face[k];
          const b = face[(k + 1) % face.length];
          if ((a === vi && b === vj) || (a === vj && b === vi)) return f;
        }
      }
      return null;
    };

    /**
     * Recomputes EVERY fold4 node's own closing rotation from scratch,
     * walking the current graph fresh -- not incrementally cached. That's
     * deliberate: a lone fold4 child (no sibling on the parent's adjacent
     * face yet) needs zero correction, but the MOMENT a second sibling
     * attaches next to it, the FIRST one's own correction changes too
     * (it now has a real edge partner) -- an earlier, incremental
     * per-node registration design got exactly this case wrong. Recomputing
     * fresh is simple, correct, and cheap at this app's real scale
     * (at most a few dozen placed nodes).
     *
     * For each fold4 connection (parent P, child C attached via P's face
     * F_P / C's face F_C): for every edge of F_P, if the OTHER parent face
     * bordering that edge is ALSO occupied by a different fold4 sibling,
     * that's a real "3 cells meet at this edge" situation (P + C + the
     * sibling) -- fold4.ts's edgeClosingCorrection gives the rotation
     * (around that edge, through its midpoint, in P's own local frame)
     * that closes C's half of the real angular defect at `t=1`, none of
     * it at `t=0`. Multiple contributing edges (a child bordering more
     * than one occupied sibling) compose sequentially into one combined
     * rotation. Converted from the parent's local frame to world, then
     * into the CHILD's own local frame, since that's the frame its own
     * `foldGroup` (nested inside its own, never-changing `object`)
     * operates in.
     */
    const recomputeAllFolds = (t: number) => {
      for (const placed of placedRef.current) {
        placed.foldGroup.matrixAutoUpdate = false;
        placed.foldGroup.matrix.identity();
        // vertexGroup stays a separate sibling (see PlacedShape's own doc
        // comment for why), but its own local matrix is kept numerically
        // in sync with foldGroup's -- otherwise a folded node's vertex
        // markers stay at their ORIGINAL unfolded spot while the mesh
        // visually rotates, so hovering near the now-rotated surface can
        // land on a stray, visually-detached vertex sphere instead (real
        // user report: "vertex attachment was triggering during assembly").
        placed.vertexGroup.matrixAutoUpdate = false;
        placed.vertexGroup.matrix.identity();
      }

      const nodeById = new Map(graphRef.current.nodes.map((n) => [n.id, n]));
      const occupiedByParent = new Map<string, Map<number, string>>();
      for (const conn of graphRef.current.connections) {
        if (conn.orphaned || conn.kind !== 'face' || !conn.fold4) continue;
        if (!occupiedByParent.has(conn.nodeA)) occupiedByParent.set(conn.nodeA, new Map());
        occupiedByParent.get(conn.nodeA)!.set(conn.vertexA, conn.nodeB);
      }
      if (occupiedByParent.size === 0) return;

      scene.updateMatrixWorld(true);

      for (const conn of graphRef.current.connections) {
        if (conn.orphaned || conn.kind !== 'face' || !conn.fold4) continue;
        const parentNode = nodeById.get(conn.nodeA);
        const parentPlaced = findPlaced(conn.nodeA);
        const childPlaced = findPlaced(conn.nodeB);
        if (!parentNode || !parentPlaced || !childPlaced) continue;
        const siblingsOnThisParent = occupiedByParent.get(conn.nodeA);
        if (!siblingsOnThisParent) continue;

        const parentSpec = POLYHEDRA[parentNode.shape];
        const parentFaceIndex = conn.vertexA;
        const faceCycle = parentSpec.faces[parentFaceIndex];
        const combined = new THREE.Matrix4();
        let anyContribution = false;

        for (let k = 0; k < faceCycle.length; k++) {
          const vi = faceCycle[k];
          const vj = faceCycle[(k + 1) % faceCycle.length];
          const otherFace = otherFaceAcrossEdge(parentSpec, parentFaceIndex, vi, vj);
          if (otherFace === null || !siblingsOnThisParent.has(otherFace)) continue;

          const corr = edgeClosingCorrection(parentSpec, parentFaceIndex, otherFace);
          if (!corr) continue;

          const pivotWorld = new THREE.Vector3(...corr.pivot).applyMatrix4(parentPlaced.object.matrixWorld);
          const axisWorld = new THREE.Vector3(...corr.axis).transformDirection(parentPlaced.object.matrixWorld).normalize();

          const childInverse = childPlaced.object.matrixWorld.clone().invert();
          const pivotLocal = pivotWorld.clone().applyMatrix4(childInverse);
          const axisLocal = axisWorld.clone().transformDirection(childInverse).normalize();

          const edgeMatrix = new THREE.Matrix4()
            .makeTranslation(pivotLocal.x, pivotLocal.y, pivotLocal.z)
            .multiply(new THREE.Matrix4().makeRotationAxis(axisLocal, corr.angleRad * t))
            .multiply(new THREE.Matrix4().makeTranslation(-pivotLocal.x, -pivotLocal.y, -pivotLocal.z));
          combined.premultiply(edgeMatrix);
          anyContribution = true;
        }

        if (anyContribution) {
          childPlaced.foldGroup.matrix.copy(combined);
          childPlaced.vertexGroup.matrix.copy(combined);
        }
      }

      scene.updateMatrixWorld(true);
    };

    /** Recomputes whether any real fold4 connection currently exists, firing onFoldConnectionsChange only on a real transition. */
    const refreshFoldConnectionsFlag = () => {
      const has = graphRef.current.connections.some((c) => !c.orphaned && c.kind === 'face' && c.fold4);
      if (has === hasFoldConnectionsRef.current) return;
      hasFoldConnectionsRef.current = has;
      if (!has) foldAmountRef.current = 0; // see foldAmountRef's own doc comment
      onFoldConnectionsChangeRef.current?.(has);
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
        if (pending.kind === 'duoprism') {
          scene.remove(pending.wallMesh);
          pending.wallMesh.geometry.dispose();
          (pending.wallMesh.material as THREE.Material).dispose();
        }
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
      for (const mesh of duoprismMeshesRef.current.values()) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      duoprismMeshesRef.current.clear();
      graphRef.current = emptyAssembly();
      hoveredRef.current = null;
      selectedRef.current = null;
      hoveredNodeRef.current = null;
      selectedNodeRef.current = null;
      hoveredFaceIndexRef.current = null;
      selectedFaceIndexRef.current = null;
      label.style.display = 'none';
      if (lastAddedNodeIdRef.current !== null) {
        lastAddedNodeIdRef.current = null;
        onCanUndoChangeRef.current?.(false);
      }
      if (hasFoldConnectionsRef.current) {
        hasFoldConnectionsRef.current = false;
        foldAmountRef.current = 0;
        onFoldConnectionsChangeRef.current?.(false);
      }
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
        if (conn.kind === 'duoprism') {
          if (a) a.faceOccupied[conn.vertexA] = true;
          if (b) b.faceOccupied[conn.vertexB] = true;
          if (a && b) {
            // Re-derive the wall-prism mesh from the two nodes' own
            // baked transforms, never stored -- same "derive, don't
            // duplicate" rule fold4 already follows. The offset is
            // read back from B's actual position relative to A's,
            // rather than recomputing duoprismBuildDepth, so this stays
            // correct even if that formula's own margin ever changes.
            scene.updateMatrixWorld(true);
            const aSpec = POLYHEDRA[assembly.nodes.find((n) => n.id === conn.nodeA)!.shape];
            const faceVertsWorld = aSpec.faces[conn.vertexA].map((i) =>
              new THREE.Vector3(...aSpec.vertices[i]).applyMatrix4(a.object.matrixWorld).toArray(),
            ) as [number, number, number][];
            const aOriginWorld = new THREE.Vector3(0, 0, 0).applyMatrix4(a.object.matrixWorld);
            const bOriginWorld = new THREE.Vector3(0, 0, 0).applyMatrix4(b.object.matrixWorld);
            const offsetWorld = bOriginWorld.clone().sub(aOriginWorld).toArray() as [number, number, number];
            const wall = buildWallPrism(faceVertsWorld, offsetWorld);
            const wallMesh = buildWallPrismMesh(wall);
            scene.add(wallMesh);
            duoprismMeshesRef.current.set(conn.nodeB, wallMesh);
          }
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
      refreshFoldConnectionsFlag();
      recomputeAllFolds(foldAmountRef.current);
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
    const beginFaceAttach = (specId: string, wantFold4 = false) => {
      const targetPlaced = selectedNodeRef.current;
      const targetFaceIndex = selectedFaceIndexRef.current;
      const spec = POLYHEDRA[specId];
      if (!targetPlaced || targetFaceIndex === null || !spec || pendingRef.current) return;
      if (targetPlaced.faceOccupied[targetFaceIndex]) return;

      const { specId: targetSpecId } = targetPlaced.object.userData as ShapeObjectUserData;
      const targetSpec = POLYHEDRA[targetSpecId];
      // See beginFaceAttach's own doc comment on ShapeViewerHandle: a
      // fold4 request only ever takes effect for a same-shape,
      // FOURD_CAPABLE_IDS-eligible self-attach -- silently degrades to an
      // ordinary flush attach otherwise rather than erroring, since the
      // real gate is isValidAssembly at save/load time regardless.
      const fold4 = wantFold4 && specId === targetSpecId && FOURD_CAPABLE_IDS.includes(specId);
      const targetFaceVerts = targetSpec.faces[targetFaceIndex];
      // Real congruence (edge lengths + angles), not just matching vertex
      // count — see the onClick filter above for why this matters once
      // irregular-faced (Catalan) shapes are selectable.
      const incomingFaceIndex = spec.faces.findIndex((f) => facesCongruent(targetSpec.vertices, targetFaceVerts, spec.vertices, f));
      if (incomingFaceIndex === -1) return; // UI should only ever offer compatible shapes

      scene.updateMatrixWorld(true);

      const targetFaceConnector = buildFaceConnectors(targetSpec)[targetFaceIndex];
      const incomingFaceConnector = buildFaceConnectors(spec)[incomingFaceIndex];

      // Read the target face's CURRENT position/normal through its own
      // foldGroup, not its outer `object` -- if the target itself is a
      // fold4 node with a nonzero closing rotation applied right now
      // (the slider isn't at 0), its rendered face has moved from the
      // outer object's own unfolded baseline. Using `object.matrixWorld`
      // here would compute a flush position for where the face WOULD be
      // at t=0, while the visible mesh sits somewhere else -- a real bug
      // found live (a newly-attached piece rendering detached from the
      // surface it was just attached to, "floating away").
      const targetWorldPos = new THREE.Vector3(...targetFaceConnector.pos).applyMatrix4(targetPlaced.foldGroup.matrixWorld);
      const targetWorldQuat = new THREE.Quaternion();
      targetPlaced.foldGroup.getWorldQuaternion(targetWorldQuat);
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
        targetPlaced.foldGroup.matrixWorld,
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

      const registrationCount = faceRotationalSymmetry(targetSpec.vertices, targetFaceVerts);
      pendingRef.current = {
        kind: 'face',
        placed,
        nodeId,
        targetPlaced,
        targetFaceIndex,
        incomingFaceIndex,
        baseQuaternion: registrationBaseQuat,
        axis: Ng,
        registrationCount,
        registration: 0,
        dragAccumPx: 0,
        fold4,
      };
      controls.enabled = false;
      clearNodeSelection();
      onPendingChangeRef.current?.(fold4 ? { specId, fold4: true } : { specId });

      // Show the registration counter immediately, not only once a drag
      // begins — essential once irregular-faced (Catalan) shapes exist:
      // a face with only 1 valid registration gives NO visible feedback
      // during a drag (there's nothing to cycle through), so without this
      // the interaction would look inert rather than correct. Reuses the
      // exact same counter every other face-attach already shows mid-drag
      // (no dedicated new UI affordance) — see docs/catalan-solids-spec.md.
      const initialRect = container.getBoundingClientRect();
      label.textContent = `registration 1/${registrationCount}`;
      label.style.left = `${initialRect.width / 2}px`;
      label.style.top = `${initialRect.height / 2}px`;
      label.style.display = 'block';
    };

    /** Builds a renderable mesh for a raw {verts, faces} structure (a wall-prism, not a full PolyhedronSpec). */
    const buildWallPrismMesh = (wall: { verts: [number, number, number][]; faces: number[][] }): THREE.Mesh => {
      const positions: number[] = [];
      for (const face of wall.faces) {
        for (const [i, j, k] of triangulateFace(face)) {
          positions.push(...wall.verts[i], ...wall.verts[j], ...wall.verts[k]);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      // Distinct teal accent (matches the "Attach via Duoprism…" button's
      // own color in page.tsx) so a wall-prism cell reads as visually
      // different from an ordinary solid or a fold4 pair, not just an
      // unlabeled extra shape.
      const material = new THREE.MeshStandardMaterial({ color: 0x2ad6c9, flatShading: true, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
      return new THREE.Mesh(geometry, material);
    };

    /**
     * The 4D Prism (duoprism) attach: see beginDuoprismAttach's own doc
     * comment on ShapeViewerHandle. Unlike beginFaceAttach, the incoming
     * node is always the SAME shape as the target, at the SAME
     * orientation (a pure translation, not a mirrored flush join) --
     * see duoprism.ts's own header comment for why that's correct, not
     * a shortcut. No registration/twist step exists to drag through, so
     * this goes straight from "begin" to a ready-to-confirm pending
     * state with its own wall-prism mesh already built.
     */
    const beginDuoprismAttach = () => {
      const targetPlaced = selectedNodeRef.current;
      const targetFaceIndex = selectedFaceIndexRef.current;
      if (!targetPlaced || targetFaceIndex === null || pendingRef.current) return;
      if (targetPlaced.faceOccupied[targetFaceIndex]) return;

      const { specId: targetSpecId } = targetPlaced.object.userData as ShapeObjectUserData;
      if (!FOURD_CAPABLE_IDS.includes(targetSpecId)) return; // UI should only ever offer this for eligible shapes
      const spec = POLYHEDRA[targetSpecId];

      scene.updateMatrixWorld(true);

      const targetFaceConnector = buildFaceConnectors(spec)[targetFaceIndex];
      // Same "read through foldGroup, not object" reasoning as
      // beginFaceAttach: the target's CURRENT rendered position/
      // orientation, not its unfolded baseline.
      const targetWorldQuat = new THREE.Quaternion();
      targetPlaced.foldGroup.getWorldQuaternion(targetWorldQuat);
      const targetWorldNormal = new THREE.Vector3(...targetFaceConnector.normal).applyQuaternion(targetWorldQuat).normalize();
      const targetOriginWorld = new THREE.Vector3(0, 0, 0).applyMatrix4(targetPlaced.foldGroup.matrixWorld);
      const offsetWorld = targetWorldNormal.clone().multiplyScalar(duoprismBuildDepth(spec, targetFaceIndex));

      const nodeId = crypto.randomUUID();
      const placed = buildPlacedShape(spec, nodeId);
      // Identical orientation, pure translation -- the defining property
      // of a duoprism's far cap (see duoprism.ts). No setFromUnitVectors
      // mirroring, no twist search: there is no discrete rotational
      // choice to make.
      placed.object.quaternion.copy(targetWorldQuat);
      placed.object.position.copy(targetOriginWorld).add(offsetWorld);
      applyViewMode(placed, viewModeRef.current);

      const faceVertsWorld = spec.faces[targetFaceIndex].map((i) =>
        new THREE.Vector3(...spec.vertices[i]).applyMatrix4(targetPlaced.foldGroup.matrixWorld).toArray(),
      ) as [number, number, number][];
      const wall = buildWallPrism(faceVertsWorld, offsetWorld.toArray() as [number, number, number]);
      const wallMesh = buildWallPrismMesh(wall);

      scene.add(placed.object);
      scene.add(wallMesh);
      applyNodeAppearance(placed, false);

      targetPlaced.faceOccupied[targetFaceIndex] = true; // reserved while pending; cancelAttach restores this
      applyNodeAppearance(targetPlaced, targetPlaced === selectedNodeRef.current);
      placed.faceOccupied[targetFaceIndex] = true; // same face role on both sides -- see AssemblyConnection's own doc comment

      pendingRef.current = {
        kind: 'duoprism',
        placed,
        nodeId,
        targetPlaced,
        targetFaceIndex,
        wallMesh,
      };
      controls.enabled = false;
      clearNodeSelection();
      onPendingChangeRef.current?.({ specId: targetSpecId, duoprism: true });
      label.style.display = 'none'; // no registration counter -- nothing to drag/cycle
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
      } else if (pending.kind === 'face') {
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
          ...(pending.fold4 ? { fold4: true as const } : {}),
        });
        if (pending.fold4) {
          refreshFoldConnectionsFlag();
          recomputeAllFolds(foldAmountRef.current);
        }
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
          vertexB: pending.targetFaceIndex,
          kind: 'duoprism',
        });
        // Keyed by the child node's own id -- matches fold4's own
        // per-child-node convention (see refreshFoldConnectionsFlag's
        // analog); a duoprism wall-prism is derived from, and lifecycle-
        // tied to, its own CHILD node, never the parent (a node can be
        // the PARENT side of many duoprism connections at once, one per
        // free face, but is only ever the CHILD side of exactly one).
        duoprismMeshesRef.current.set(pending.nodeId, pending.wallMesh);
      }

      lastAddedNodeIdRef.current = pending.nodeId;
      onCanUndoChangeRef.current?.(true);

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
     * Removes `nodeId` and cascades to its whole subtree (every node
     * reachable by following nodeA -> nodeB edges from it — see
     * collectSubtree in app/lib/graph.ts). The parent's own vertex or
     * face, if any, is freed again so something new can attach there.
     * Shared by deleteSelectedNode (Stage 8) and undo below — the same
     * real removal logic either way, just a different way of arriving
     * at which nodeId to remove.
     */
    const deleteNodeById = (nodeId: string): DeleteResult | null => {
      if (!graphRef.current.nodes.some((n) => n.id === nodeId)) return null;

      const subtreeIds = collectSubtree(graphRef.current.connections, nodeId);
      const parentConn = findParentConnection(graphRef.current.connections, nodeId);

      for (const id of subtreeIds) {
        const placed = findPlaced(id);
        if (!placed) continue;

        scene.remove(placed.object);
        disposePlacedShape(placed);
        const idx = placedRef.current.indexOf(placed);
        if (idx !== -1) placedRef.current.splice(idx, 1);

        const wallMesh = duoprismMeshesRef.current.get(id);
        if (wallMesh) {
          scene.remove(wallMesh);
          wallMesh.geometry.dispose();
          (wallMesh.material as THREE.Material).dispose();
          duoprismMeshesRef.current.delete(id);
        }

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
        if (parentConn.kind === 'face' || parentConn.kind === 'duoprism') {
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

      refreshFoldConnectionsFlag();
      recomputeAllFolds(foldAmountRef.current);

      // If the node being removed (or anything in its subtree) was the
      // tracked "most recently added" node, there's nothing left for
      // undo to target.
      if (lastAddedNodeIdRef.current !== null && subtreeIds.has(lastAddedNodeIdRef.current)) {
        lastAddedNodeIdRef.current = null;
        onCanUndoChangeRef.current?.(false);
      }

      clearNodeSelection();
      label.style.display = 'none';
      reportCageStatus();
      return { deletedCount: subtreeIds.size };
    };

    /** Stage 8: remove the currently selected node (and its subtree). */
    const deleteSelectedNode = (): DeleteResult | null => {
      const node = selectedNodeRef.current;
      if (!node) return null;
      const { nodeId } = node.object.userData as ShapeObjectUserData;
      return deleteNodeById(nodeId);
    };

    /**
     * Removes the single most recently confirmed attach (and whatever's
     * been built on top of it since) -- see undo()'s own doc comment on
     * ShapeViewerHandle for the exact semantics. Single-level: clears
     * the tracked node id either way, so calling this again immediately
     * is a no-op until a fresh confirmAttach/beginFaceAttach re-arms it.
     */
    const undo = (): DeleteResult | null => {
      const nodeId = lastAddedNodeIdRef.current;
      if (!nodeId) return null;
      const result = deleteNodeById(nodeId);
      // deleteNodeById already clears lastAddedNodeIdRef + fires the
      // callback when it finds the target node in the subtree it
      // removed -- but guard here too in case the node had somehow
      // already gone stale (deleted some other way without going
      // through deleteNodeById), so undo is never callable twice.
      if (lastAddedNodeIdRef.current === nodeId) {
        lastAddedNodeIdRef.current = null;
        onCanUndoChangeRef.current?.(false);
      }
      return result;
    };

    // graphRef.current is the SAME object saveAssembly below POSTs to the
    // server -- returned directly (not cloned) since this is read
    // synchronously by the caller (JSON.stringify right after the call),
    // well before anything else in this single-threaded flow could
    // mutate it.
    const getAssembly = (): Assembly => graphRef.current;

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

    const setFoldAmount = (t: number) => {
      foldAmountRef.current = t;
      recomputeAllFolds(t); // its own trailing updateMatrixWorld(true) covers the immediate-raycast concern too
    };

    onReadyRef.current?.({
      reset: placeRoot,
      beginAttach,
      beginFaceAttach,
      beginDuoprismAttach,
      confirmAttach,
      cancelAttach,
      save: saveAssembly,
      rewriteSelectedNode,
      deleteSelectedNode,
      undo,
      getAssembly,
      setViewMode,
      setFoldAmount,
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
    // Tracks the most recent real PointerEvent's pointerType -- see
    // positionLabel's own comment for why this is needed (onClick's
    // native 'click' MouseEvent never carries pointerType itself, even
    // for a touch-originated tap).
    let lastPointerType = 'mouse';

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
      hideFaceHighlight();
      label.style.display = 'none';
    };

    // Positions the hover/status label relative to the pointer. On touch,
    // the lower-right offset that reads fine next to a mouse cursor puts
    // the label directly under the finger that's currently touching --
    // real user report ("text... is hidden under finger, should appear
    // above touch point"). Shifted up (and slightly left, so it doesn't
    // run as far off narrow phone screens) instead.
    //
    // isTouch can't just check event.pointerType here: onClick's own
    // event is a native 'click' MouseEvent, which -- even for a
    // touch-originated tap -- never carries pointerType at all (that's
    // PointerEvent-only), so a plain-tap gesture (pointerdown+pointerup
    // with no real intervening pointermove, the common case) would only
    // ever reach updateHover via onClick and silently fall through to
    // the mouse-style offset regardless of device. lastPointerTypeRef
    // (set from the real PointerEvents onPointerDown/onPointerMove do
    // receive) is the fallback for exactly that gap.
    const positionLabel = (event: MouseEvent, rect: DOMRect) => {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const eventPointerType = 'pointerType' in event ? (event as PointerEvent).pointerType : undefined;
      const isTouch = (eventPointerType ?? lastPointerType) === 'touch';
      if (isTouch) {
        label.style.left = `${x - 60}px`;
        label.style.top = `${y - 70}px`;
      } else {
        label.style.left = `${x + 14}px`;
        label.style.top = `${y + 14}px`;
      }
    };

    // The actual vertex/node-body raycast, shared by onPointerMove (real
    // hover, mouse/pen) AND onClick (called fresh at click time) -- touch
    // devices don't fire a pointermove before the FIRST pointerdown of a
    // fresh tap (nothing to move through before contact begins), so
    // onClick reading only whatever hoveredRef/hoveredNodeRef happened to
    // be set by a prior pointermove left touch taps seeing stale/null
    // hover state and never resolving to anything -- real user report
    // ("haven't been able to attach anything... no support for phone
    // tablet"). Re-raycasting at the exact click/tap position, right
    // before onClick reads the hover refs, makes both paths correct
    // regardless of whether a real hover preceded this interaction.
    const updateHover = (event: MouseEvent, rect: DOMRect) => {
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
        hideFaceHighlight();
        const { vertexId, degree, occupied } = hit.userData as VertexUserData;
        label.textContent = occupied
          ? `vertex ${vertexId} — capacity ${degree} (occupied)`
          : `vertex ${vertexId} — capacity ${degree}`;
        positionLabel(event, rect);
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
        if (faceIndex !== null) showFaceHighlight(node, faceIndex);
        else hideFaceHighlight();

        const { specId } = node.object.userData as ShapeObjectUserData;
        const rewriteTarget = REWRITE_TARGET[specId];
        const actions = ['delete'];
        if (rewriteTarget) actions.push(`transform → ${rewriteTarget}`);
        if (faceIndex !== null && !node.faceOccupied[faceIndex]) {
          const faceSize = POLYHEDRA[specId].faces[faceIndex].length;
          actions.push(`attach via this ${faceSize}-gon face`);
        }
        label.textContent = `click to select ${specId} node (${actions.join(', ')})`;
        positionLabel(event, rect);
        label.style.display = 'block';
      } else {
        hoveredNodeRef.current = null;
        hoveredFaceIndexRef.current = null;
        hideFaceHighlight();
        label.style.display = 'none';
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      const pending = pendingRef.current;
      const rect = container.getBoundingClientRect();

      if (pending) {
        if (isDragging) {
          const dragDeltaX = event.clientX - lastDragX;
          lastDragX = event.clientX;
          if (pending.kind === 'vertex') {
            pending.twistAngle += dragDeltaX * TWIST_SENSITIVITY;
            const twistQuat = new THREE.Quaternion().setFromAxisAngle(pending.attachLocalDir, pending.twistAngle);
            pending.placed.object.quaternion.copy(pending.baseQuaternion).multiply(twistQuat);

            const degrees = THREE.MathUtils.radToDeg(pending.twistAngle) % 360;
            label.textContent = `twist ${degrees.toFixed(0)}°`;
            positionLabel(event, rect);
            label.style.display = 'block';
          } else if (pending.kind === 'face') {
            pending.dragAccumPx += dragDeltaX;
            while (pending.dragAccumPx >= FACE_REGISTRATION_DRAG_PX) {
              pending.dragAccumPx -= FACE_REGISTRATION_DRAG_PX;
              pending.registration = (pending.registration + 1) % pending.registrationCount;
            }
            while (pending.dragAccumPx <= -FACE_REGISTRATION_DRAG_PX) {
              pending.dragAccumPx += FACE_REGISTRATION_DRAG_PX;
              pending.registration = (pending.registration - 1 + pending.registrationCount) % pending.registrationCount;
            }
            const angle = (pending.registration * 2 * Math.PI) / pending.registrationCount;
            const twistQuat = new THREE.Quaternion().setFromAxisAngle(pending.axis, angle);
            pending.placed.object.quaternion.copy(pending.baseQuaternion).multiply(twistQuat);

            label.textContent = `registration ${pending.registration + 1}/${pending.registrationCount}`;
            positionLabel(event, rect);
            label.style.display = 'block';
          }
          // 'duoprism': no drag/registration behavior at all -- there is
          // no rotational freedom to cycle through (see
          // beginDuoprismAttach's own doc comment), so a drag here is
          // simply inert.
        }
        return; // selection/hover raycasting is locked while a piece is pending
      }

      updateHover(event, rect);
    };

    // Manually-tracked position delta, not event.movementX/movementY --
    // Safari's support for movementX/Y on touch-originated PointerEvents
    // is real but historically unreliable (frequently 0 regardless of
    // actual finger movement), which would make the whole twist-drag
    // gesture below silently do nothing on iOS touch even though the
    // exact same code drives a real mouse drag correctly. clientX/Y
    // deltas computed by hand here have no such platform gap.
    let lastDragX = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (!pendingRef.current) return;
      isDragging = true;
      lastDragX = event.clientX;
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

    const onClick = (event: MouseEvent) => {
      if (pendingRef.current) return; // confirm/cancel drive pending state, not clicks

      // Re-raycast at the click's own position before trusting the hover
      // refs below -- see updateHover's own comment for why: touch never
      // fires a pointermove before a fresh tap's pointerdown, so without
      // this, hoveredRef/hoveredNodeRef could be stale or still null on
      // mobile, and a tap would silently select/attach nothing at all.
      updateHover(event, container.getBoundingClientRect());

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
      // Vertex count alone isn't enough once irregular-faced families exist
      // (Catalan solids): a rhombus and a kite can both have 4 vertices
      // without being the same shape at all, so gluing one onto the other
      // wouldn't sit flush. facesCongruent checks the real edge-length +
      // angle sequence — reduces to plain vertex-count matching for every
      // regular-faced shape already in this registry (any two same-size
      // faces there already ARE the same regular polygon), so this changes
      // nothing for existing families and only starts mattering once
      // irregular ones are selectable. See docs/catalan-solids-spec.md.
      const targetFace = faceIndex !== null ? POLYHEDRA[specId].faces[faceIndex] : null;
      const targetVertices = POLYHEDRA[specId].vertices;
      const faceAttachOptions =
        faceIndex !== null && targetFace !== null && !faceOccupied
          ? POLYHEDRON_IDS.filter((id) =>
              POLYHEDRA[id].faces.some((f) => facesCongruent(targetVertices, targetFace, POLYHEDRA[id].vertices, f)),
            )
          : [];
      const faceFold4Eligible = faceIndex !== null && !faceOccupied && FOURD_CAPABLE_IDS.includes(specId);
      const faceDuoprismEligible = faceFold4Eligible;

      onNodeSelectionChangeRef.current?.({
        nodeId,
        specId,
        rewriteTarget: REWRITE_TARGET[specId] ?? null,
        faceIndex,
        faceSize,
        faceOccupied,
        faceAttachOptions,
        faceFold4Eligible,
        faceDuoprismEligible,
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
      faceHighlightMesh.geometry.dispose();
      faceHighlightMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
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
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      // Real user report on iPad: a long touch on the scene triggers the
      // OS's native text-selection/magnifier "highlight" UI instead of
      // reaching this component's own pointer handlers -- nothing here
      // told the browser this canvas isn't selectable text/content.
      // touchAction:none also stops the browser from treating a drag as
      // a page-scroll/pinch-zoom attempt, which competes with the
      // custom vertex-select/rotate gestures the same way.
      style={{
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <div
        ref={labelRef}
        className="pointer-events-none absolute z-10 hidden rounded bg-black/80 px-2 py-1 text-xs text-white"
      />
    </div>
  );
}
