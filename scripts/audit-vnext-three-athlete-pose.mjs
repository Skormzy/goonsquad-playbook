import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AnimationMixer,
  Box3,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(root, process.argv[2] ?? 'src/assets/vnext3d-review/field-home-cmu16-ik-diagonal-stick.glb');
const output = path.resolve(
  root,
  process.argv[3] ?? 'docs/vnext/evidence/athlete-diagonal-stick-review/three-sprint-pose-audit.json',
);
const clipName = process.argv[4] ?? 'sprint';
const normalizedPhase = Number(process.argv[5] ?? 0.0175);

globalThis.self = globalThis;

const bytes = await fs.readFile(input);
const loader = new GLTFLoader();
const gltf = await new Promise((resolve, reject) => {
  loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject);
});
const model = clone(gltf.scene);
const clip = gltf.animations.find((animation) => animation.name === clipName);
if (!clip) throw new Error(`Missing animation clip: ${clipName}`);

const trackedBones = [
  'CC_Base_L_Upperarm',
  'CC_Base_L_Forearm',
  'CC_Base_L_Hand',
  'CC_Base_R_Upperarm',
  'CC_Base_R_Forearm',
  'CC_Base_R_Hand',
  'GS_Stick_Control',
];
const trackedMeshes = [];
model.traverse((object) => {
  if (!object.isSkinnedMesh) return;
  if (/Body|Jersey|Glove|Stick|Shoe/i.test(object.name)) trackedMeshes.push(object.name);
});

function vector(value) {
  return value.toArray().map((entry) => Number(entry.toFixed(6)));
}

function bonePositions() {
  model.updateMatrixWorld(true);
  return Object.fromEntries(trackedBones.map((name) => {
    const bone = model.getObjectByName(name);
    return [name, bone ? vector(bone.getWorldPosition(new Vector3())) : null];
  }));
}

function deformedBounds(mesh) {
  if (!mesh?.isSkinnedMesh || !mesh.geometry?.attributes?.position) return null;
  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  const box = new Box3().makeEmpty();
  const source = mesh.geometry.attributes.position;
  const vertex = new Vector3();
  for (let index = 0; index < source.count; index += 1) {
    vertex.fromBufferAttribute(source, index);
    mesh.applyBoneTransform(index, vertex);
    vertex.applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(vertex);
  }
  return {
    min: vector(box.min),
    max: vector(box.max),
    size: vector(box.getSize(new Vector3())),
  };
}

function meshBounds() {
  return Object.fromEntries(trackedMeshes.map((name) => {
    const mesh = model.getObjectByName(name);
    return [name, deformedBounds(mesh)];
  }));
}

const rest = {
  bones: bonePositions(),
  meshes: meshBounds(),
};
const mixer = new AnimationMixer(model);
const action = mixer.clipAction(clip, model);
action.reset().play();
action.time = normalizedPhase * clip.duration;
mixer.update(0);
model.updateMatrixWorld(true);
const animated = {
  bones: bonePositions(),
  meshes: meshBounds(),
};

const report = {
  status: 'three-runtime-pose-audited',
  input: path.relative(root, input).replaceAll('\\', '/'),
  clip: clipName,
  clipDurationSeconds: clip.duration,
  normalizedPhase,
  rest,
  animated,
};
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`GOON_VNEXT_THREE_POSE_AUDITED ${output}`);
