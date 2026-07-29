import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const sourceDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-source',
);
const manifest = JSON.parse(fs.readFileSync(
  path.join(sourceDirectory, 'production-glove-source-manifest.json'),
  'utf8',
));
const sha256 = (filePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

describe('vNext production glove source qualification', () => {
  it('keeps every external source blocked until its exact delivery rights are cleared', () => {
    expect(manifest).toMatchObject({
      status: 'qualified-no-source-acquired',
      decision: 'author-local-continuous-production-mesh',
      generatedApproachClosed: true,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      localProductionMeshReady: false,
      sourceMeshFilesPresent: false,
    });
    expect(manifest.candidates).toHaveLength(4);
    expect(manifest.candidates.every(({ runtimeStatus }) => runtimeStatus !== 'approved'))
      .toBe(true);
    expect(manifest.licenseAuthorities).toHaveLength(4);
  });

  it('records a qualified manufactured-equipment reference and a legal open-scan fallback', () => {
    const preferred = manifest.candidates.find(({ id }) => (
      id === manifest.recommendedPath.primaryCandidateId
    ));
    expect(preferred).toMatchObject({
      id: 'turbosquid-2385567',
      rigged: true,
      pbr: true,
      visualQualification: 'preferred',
      runtimeStatus: 'blocked-pending-written-webgl-clearance',
    });

    const openScan = manifest.candidates.find(({ id }) => (
      id === manifest.recommendedPath.openScanCandidateId
    ));
    expect(openScan).toMatchObject({
      license: 'CC BY 4.0',
      downloadable: true,
      constructionQualification: 'vintage-form-requires-complete-modernization',
      runtimeStatus: 'not-production-ready',
      downloadProbe: { status: 401 },
    });
  });

  it('integrity-checks the internal source previews', () => {
    for (const preview of manifest.previewEvidence) {
      const previewPath = path.join(root, preview.path);
      expect(fs.existsSync(previewPath)).toBe(true);
      expect(sha256(previewPath)).toBe(preview.sha256);
      expect(fs.statSync(previewPath).size).toBeGreaterThan(50_000);
    }
  });

  it('contains no unapproved source mesh and exposes no new runtime selector', () => {
    const forbidden = new Set(manifest.forbiddenIntakeExtensions);
    const sourceMeshes = fs
      .readdirSync(sourceDirectory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((filePath) => forbidden.has(path.extname(filePath).toLowerCase()));
    expect(sourceMeshes).toEqual([]);

    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-source');
    expect(assetsModule).not.toContain('turbosquid-2385567');
  });

  it('passes the standalone fail-closed intake validator', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/validate-vnext-production-glove-source.mjs'],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('GOON_VNEXT_PRODUCTION_GLOVE_SOURCE_QUALIFIED');
    expect(result.stdout).toContain('"sourceMeshFilesPresent": false');
    expect(result.stdout).toContain('"publicRuntimeAllowed": false');
  });
});
