import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-source',
);
const manifestPath = path.join(sourceDirectory, 'production-glove-source-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const fail = (message) => {
  throw new Error(`Production glove source validation failed: ${message}`);
};

const sha256 = (filePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

if (manifest.status !== 'qualified-no-source-acquired') {
  fail(`unexpected status ${manifest.status}`);
}
if (manifest.decision !== 'author-local-continuous-production-mesh') {
  fail(`unexpected decision ${manifest.decision}`);
}
if (!manifest.generatedApproachClosed) fail('generated glove approach must remain closed');
if (manifest.publicRuntimeAllowed) fail('public runtime cannot use an unlicensed source');
if (manifest.acceptedRuntimeAssetsChanged) fail('accepted runtime assets must remain unchanged');
if (manifest.localProductionMeshReady) fail('manifest cannot claim a production mesh exists');
if (manifest.sourceMeshFilesPresent) fail('manifest cannot claim an admitted source mesh');

const candidates = new Map(manifest.candidates.map((candidate) => [candidate.id, candidate]));
const preferred = candidates.get(manifest.recommendedPath.primaryCandidateId);
if (!preferred) fail('preferred candidate is missing');
if (preferred.runtimeStatus !== 'blocked-pending-written-webgl-clearance') {
  fail('preferred candidate must remain blocked pending written WebGL clearance');
}
if (!preferred.rigged || preferred.visualQualification !== 'preferred') {
  fail('preferred candidate does not satisfy the recorded rig and visual qualification');
}

const openScan = candidates.get(manifest.recommendedPath.openScanCandidateId);
if (!openScan) fail('open scan candidate is missing');
if (openScan.license !== 'CC BY 4.0' || openScan.downloadProbe.status !== 401) {
  fail('open scan license or authenticated-download boundary changed');
}
if (openScan.runtimeStatus === 'approved') fail('vintage scan cannot be runtime approved');

for (const candidate of manifest.candidates) {
  if (candidate.runtimeStatus === 'approved') {
    fail(`${candidate.id} cannot be approved without an admitted and audited source mesh`);
  }
}

for (const preview of manifest.previewEvidence) {
  const previewPath = path.join(root, preview.path);
  if (!fs.existsSync(previewPath)) fail(`missing preview ${preview.path}`);
  if (sha256(previewPath) !== preview.sha256) fail(`preview hash mismatch ${preview.path}`);
}

const forbiddenExtensions = new Set(
  manifest.forbiddenIntakeExtensions.map((extension) => extension.toLowerCase()),
);
const admittedMeshFiles = fs
  .readdirSync(sourceDirectory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name))
  .filter((filePath) => forbiddenExtensions.has(path.extname(filePath).toLowerCase()));
if (admittedMeshFiles.length > 0) {
  fail(`unapproved mesh files found: ${admittedMeshFiles.join(', ')}`);
}

const contract = fs.readFileSync(path.join(root, manifest.targetContract), 'utf8');
if (!contract.includes('The generated glove path is closed')) {
  fail('replacement contract no longer closes the generated approach');
}
if (!manifest.nextConcreteStep.includes('continuous modern glove base locally in Blender')) {
  fail('next step must remain the local continuous-mesh path');
}

console.log(JSON.stringify({
  status: 'GOON_VNEXT_PRODUCTION_GLOVE_SOURCE_QUALIFIED',
  decision: manifest.decision,
  candidatesReviewed: manifest.candidates.length,
  rejectedCandidates: manifest.rejectedCandidates.length,
  preferredCandidate: preferred.id,
  sourceMeshFilesPresent: false,
  publicRuntimeAllowed: false,
}, null, 2));
