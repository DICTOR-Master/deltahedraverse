import * as THREE from 'three';
import { POLYHEDRA, POLYHEDRON_IDS, type PolyhedronSpec } from '../app/lib/polyhedra';
import { buildFaceConnectors, facesCongruent } from '../app/lib/polyhedra/core';

// Mirrors ShapeViewer.tsx's face-attach math (root parent, identity
// transform) so the exact placement formula gets checked outside the
// browser. Face-attach has no free rotational DOF the way vertex-attach
// does: two congruent regular n-gon faces coincide fully once (a) the
// normals are opposed and (b) one reference vertex pair is aligned -- the
// rest follow from congruence. Getting there took an actual wrong turn
// worth recording: a first attempt assumed the right alignment was always
// among the n multiples of 360/n starting from "no extra twist" and swept
// only those -- for many shape pairs, none of the n candidates matched
// (confirmed empirically, not assumed). The fix was computing the required
// angle analytically (aligning incoming's own reference vertex direction to
// target's, via atan2 in the shared plane) instead of guessing candidates.
function computeFaceAttach(
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

  // Rotate the incoming face's outward normal to point opposite the
  // target's, same principle as vertex-attach: the incoming shape ends up
  // facing back toward what it's joining, not overlapping it.
  const desiredWorldDir = Nf.clone().negate();
  const baseQuat = new THREE.Quaternion().setFromUnitVectors(Ng, desiredWorldDir);

  const targetFaceIndices = rootSpec.faces[targetFaceIdx];
  const incomingFaceIndices = incomingSpec.faces[incomingFaceIdx];

  // The remaining freedom after baseQuat is a rotation around the shared
  // normal axis. Compute it analytically: align incoming's own vertex-0
  // direction (from its face centroid) to point where target's vertex-0
  // needs it to, using a 2D basis in the shared plane.
  const targetV0 = new THREE.Vector3(...rootSpec.vertices[targetFaceIndices[0]]);
  const dTargetWorld = targetV0.clone().sub(Cf).normalize();
  const dTargetLocal = dTargetWorld.clone().applyQuaternion(baseQuat.clone().invert());

  const incomingV0 = new THREE.Vector3(...incomingSpec.vertices[incomingFaceIndices[0]]);
  const dIncomingLocal = incomingV0.clone().sub(Cg).normalize();

  const u = dIncomingLocal.clone();
  const w = new THREE.Vector3().crossVectors(Ng, u).normalize();
  const theta = Math.atan2(dTargetLocal.dot(w), dTargetLocal.dot(u));

  const twistQuat = new THREE.Quaternion().setFromAxisAngle(Ng, theta);
  const finalQuat = baseQuat.clone().multiply(twistQuat);

  const rotatedCg = Cg.clone().applyQuaternion(finalQuat);
  const position = Cf.clone().sub(rotatedCg);

  return { finalQuat, position, targetFaceIndices, incomingFaceIndices, Cf, Nf };
}

let checks = 0;
let failures = 0;

for (const rootId of POLYHEDRON_IDS) {
  const rootSpec = POLYHEDRA[rootId];
  for (const incomingId of POLYHEDRON_IDS) {
    const incomingSpec = POLYHEDRA[incomingId];
    for (let tf = 0; tf < rootSpec.faces.length; tf++) {
      for (let gf = 0; gf < incomingSpec.faces.length; gf++) {
        // Real congruence (edge lengths + angles), not just matching vertex
        // count -- matching the app's own compatibility check (ShapeViewer.tsx),
        // now that irregular-faced (Catalan) shapes exist where two
        // same-vertex-count faces (e.g. two different rhombi) aren't
        // necessarily the same shape. Testing pairs the app would never
        // offer isn't useful: their vertices genuinely don't coincide, but
        // that's not an attach-math bug, it's the app correctly declining
        // an incompatible pair before this code ever runs.
        if (!facesCongruent(rootSpec.vertices, rootSpec.faces[tf], incomingSpec.vertices, incomingSpec.faces[gf])) continue;
        checks++;

        const { finalQuat, position, targetFaceIndices, incomingFaceIndices, Cf, Nf } = computeFaceAttach(
          rootSpec,
          tf,
          incomingSpec,
          gf,
        );

        const n = targetFaceIndices.length;
        const targetVerts = targetFaceIndices.map((i) => new THREE.Vector3(...rootSpec.vertices[i]));
        const incomingVertsWorld = incomingFaceIndices.map((i) =>
          new THREE.Vector3(...incomingSpec.vertices[i]).applyQuaternion(finalQuat).add(position),
        );

        // 1. Every incoming face vertex must land exactly on the
        //    corresponding target vertex. Two solids facing opposite
        //    directions trace their shared boundary in opposite rotational
        //    sense, so the correspondence is reversed: incoming[i] <-> target[(n-i)%n].
        let coincidence = 0;
        for (let i = 0; i < n; i++) {
          coincidence += incomingVertsWorld[i].distanceTo(targetVerts[(n - i) % n]);
        }
        if (coincidence > 1e-9) {
          failures++;
          console.log(
            `${rootId}[f${tf}] + ${incomingId}[f${gf}]: coincidence error ${coincidence.toExponential(3)}`,
          );
        }

        // 2. The incoming shape's centroid (world origin of its local
        //    frame) must end up on the far side of the shared face from the
        //    root's own centroid -- growing outward, not overlapping.
        const incomingCentroidWorld = position; // local origin transforms to `position` exactly
        const rootDepth = Cf.dot(Nf);
        const incomingDepth = incomingCentroidWorld.dot(Nf);
        if (incomingDepth <= rootDepth - 1e-9) {
          failures++;
          console.log(
            `${rootId}[f${tf}] + ${incomingId}[f${gf}]: incoming centroid (${incomingDepth.toFixed(4)}) ` +
              `not beyond shared face (${rootDepth.toFixed(4)}) along its outward normal`,
          );
        }
      }
    }
  }
}

console.log(`${checks} face-attach placements checked, ${failures} failed.`);
if (failures > 0) process.exit(1);
