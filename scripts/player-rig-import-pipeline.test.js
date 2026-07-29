import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('player rig import pipeline', () => {
  it('chains internal Node scripts directly so Windows command shims do not break import', () => {
    const script = readFileSync('scripts/import-production-player-rigs.mjs', 'utf8');

    expect(script).toContain("await run(process.execPath, ['scripts/sync-player-rig-manifest.mjs'])");
    expect(script).toContain("await run(process.execPath, ['scripts/write-player-rig-readiness-report.mjs'])");
    expect(script).toContain("'scripts/validate-player-rig.mjs'");
    expect(script).toContain("'--join-named'");
    expect(script).toContain("'--palette'");
    expect(script).toContain("'false'");
    expect(script).toContain("'512'");
    expect(script).not.toContain('npmCommand');
  });

  it('preserves normalized runner GLBs instead of running destructive mesh optimization', () => {
    const script = readFileSync('scripts/import-production-player-rigs.mjs', 'utf8');

    expect(script).toContain('copyFile');
    expect(script).toContain('getRigRoleForProductionKey(item.key)');
    expect(script).toContain("role === 'runner'");
    expect(script).toContain('Preserving normalized runner GLB');
  });
});
