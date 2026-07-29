import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('vNext strategy-first 3D reset', () => {
  it('keeps the complete flagship replay active instead of close asset polishing', () => {
    const requirements = JSON.parse(fs.readFileSync(
      path.join(root, 'docs/vnext/requirements.json'),
      'utf8',
    ));
    const athlete = requirements.requirements.find(({ id }) => id === '3d-athlete-runtime');
    const flagship = requirements.requirements.find(({ id }) => id === '3d-standard-breakout');

    expect(athlete.status).toBe('done');
    expect(flagship.status).toBe('in_progress');
    expect(flagship.priority).toBeGreaterThan(athlete.priority);
    expect(flagship.dependencies).not.toContain('3d-grounding-and-motion');
  });

  it('uses the strongest complete tactical-distance athlete package by default', () => {
    const preview = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/ProductionReplayPreview.jsx'),
      'utf8',
    );
    const assets = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );

    expect(assets).toContain("TACTICAL_DISTANCE_BASELINE_ID = 'cmu-jog16-ik-neck-boundary'");
    expect(preview).toContain('?? TACTICAL_DISTANCE_BASELINE_ID');
    expect(preview).toContain('TACTICAL REPLAY');
  });

  it('protects the value order from another equipment-detail rabbit hole', () => {
    const contract = fs.readFileSync(path.join(root, 'docs/vnext/AUTOPILOT.md'), 'utf8');
    const brief = fs.readFileSync(path.join(root, 'docs/vnext/PRODUCT_BRIEF.md'), 'utf8');

    expect(contract).toContain('complete 12-player Standard Breakout replay');
    expect(contract).toContain('glove stitching');
    expect(brief.indexOf('Tactical correctness')).toBeLessThan(brief.indexOf('Close-up character'));
  });

  it('records smooth full-play motion with the corrected ball route', () => {
    const evidence = JSON.parse(fs.readFileSync(
      path.join(root, 'docs/vnext/evidence/strategy-first-standard-breakout/playback-motion.json'),
      'utf8',
    ));

    for (const result of Object.values(evidence.results)) {
      expect(result.passesSmoothPlayback).toBe(true);
      expect(result.finalReplayTime).toBe(8.8);
      expect(result.finalBallOwner).toBe('US_LW');
      expect(result.crossCourtPassObserved).toBe(false);
      expect(result.observedBallSegments).not.toContain('pass');
    }
  });
});
