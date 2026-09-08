import * as THREE from 'three';
import { POLYHEDRA, POLYHEDRON_IDS, type PolyhedronSpec } from '../app/lib/polyhedra';
import { buildFaceConnectors, facesCongruent, faceRotationalSymmetry } from '../app/lib/polyhedra/core';

// Unlike vertex-attach, a face-to-face join has no continuously-free twist
// -- but it does have n discrete valid "registrations" (which incoming
// vertex sits at which target vertex), since rotating a regular n-gon by
// any multiple of 360/n around its own center maps it onto itself. This
// checks that claim directly: the base analytic angle (see
// verify-face-attach.ts) plus any multiple of 360/n must still coincide
// exactly, just with the vertex correspondence cyclically shifted.
function computeBaseFaceAttach(
  rootSpec: PolyhedronSpec,
  targetFaceIdx: number,
  incomingSpec: PolyhedronSpec,
  incomingFaceIdx: number,
) {
  const targetFace = buildFaceConnectors(rootSpec)[targetFaceIdx];
  const incomingFace = buildFaceConnectors(incomingSpec)[incomingFaceIdx];

  const Cf = new THREE.Vector3(...targetFace.pos);
  const Nf = new THREE.Vector3(...targetFace.normal);
  const Cg = new THREE.Vector3(...incomingFace.pos);
  const Ng = new THREE.Vector3(...incomingFace.normal);

  const desiredWorldDir = Nf.clone().negate();
  const baseQuat = new THREE.Quaternion().setFromUnitVectors(Ng, desiredWorldDir);

  const targetFaceIndices = rootSpec.faces[targetFaceIdx];
  const incomingFaceIndices = incomingSpec.faces[incomingFaceIdx];

  const targetV0 = new THREE.Vector3(...rootSpec.vertices[targetFaceIndices[0]]);
  const dTargetWorld = targetV0.clone().sub(Cf).normalize();
  const dTargetLocal = dTargetWorld.clone().applyQuaternion(baseQuat.clone().invert());

  const incomingV0 = new THREE.Vector3(...incomingSpec.vertices[incomingFaceIndices[0]]);
  const dIncomingLocal = incomingV0.clone().sub(Cg).normalize();

  const u = dIncomingLocal.clone();
  const w = new THREE.Vector3().crossVectors(Ng, u).normalize();
  const theta = Math.atan2(dTargetLocal.dot(w), dTargetLocal.dot(u));

  return { baseQuat, theta, Ng, Cg, Cf, targetFaceIndices, incomingFaceIndices };
}

let checks = 0;
let failures = 0;

for (const rootId of POLYHEDRON_IDS) {
  const rootSpec = POLYHEDRA[rootId];
  for (const incomingId of POLYHEDRON_IDS) {
    const incomingSpec = POLYHEDRA[incomingId];
    // Sample face 0 of each shape only (the registration-cycle property is
    // about the *rotation formula*, not particular face choice, and
    // verify-face-attach.ts already covers every face pair exhaustively).
    const tf = 0;
    const gf = 0;
    // Real congruence, not just matching vertex count -- see verify-face-attach.ts.
    if (!facesCongruent(rootSpec.vertices, rootSpec.faces[tf], incomingSpec.vertices, incomingSpec.faces[gf])) continue;

    const { baseQuat, theta, Ng, Cg, Cf, targetFaceIndices, incomingFaceIndices } = computeBaseFaceAttach(
      rootSpec,
      tf,
      incomingSpec,
      gf,
    );
    // The number of valid registrations is the face's OWN rotational
    // symmetry order, not its vertex count -- only the same for a regular
    // n-gon. A rhombus has 4 vertices but 2-fold symmetry; most Catalan
    // faces have 1-fold (no non-identity rotation preserves them at all).
    const registrationCount = faceRotationalSymmetry(rootSpec.vertices, targetFaceIndices);
    const targetVerts = targetFaceIndices.map((i) => new THREE.Vector3(...rootSpec.vertices[i]));

    for (let k = 0; k < registrationCount; k++) {
      checks++;
      const registrationAngle = theta + (k * 2 * Math.PI) / registrationCount;
      const twistQuat = new THREE.Quaternion().setFromAxisAngle(Ng, registrationAngle);
      const finalQuat = baseQuat.clone().multiply(twistQuat);
      const rotatedCg = Cg.clone().applyQuaternion(finalQuat);
      const position = Cf.clone().sub(rotatedCg);

      const incomingVertsWorld = incomingFaceIndices.map((i) =>
        new THREE.Vector3(...incomingSpec.vertices[i]).applyQuaternion(finalQuat).add(position),
      );

      // Order-independent check: what matters physically is that the *set*
      // of incoming face vertices coincides with the *set* of target face
      // vertices, not that any particular presumed index formula holds
      // (which incoming vertex lands on which target vertex shifts with k
      // in a way this script doesn't need to predict — the app never
      // relies on that correspondence either, only on the shapes actually
      // touching flush). Check it's a bijection within tolerance.
      const unmatched = new Set(targetVerts.map((_, j) => j));
      let coincidence = 0;
      for (const iv of incomingVertsWorld) {
        let bestJ = -1;
        let bestD = Infinity;
        for (const j of unmatched) {
          const d = iv.distanceTo(targetVerts[j]);
          if (d < bestD) {
            bestD = d;
            bestJ = j;
          }
        }
        coincidence += bestD;
        unmatched.delete(bestJ);
      }
      if (coincidence > 1e-9) {
        failures++;
        console.log(`${rootId}[f${tf}] + ${incomingId}[f${gf}] @ registration k=${k}: coincidence error ${coincidence.toExponential(3)}`);
      }
    }
  }
}

console.log(`${checks} face registrations checked, ${failures} failed.`);
if (failures > 0) process.exit(1);
