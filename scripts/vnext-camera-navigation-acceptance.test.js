import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const preview = fs.readFileSync(
  path.join(root, 'src/components/vnext3d/ProductionReplayPreview.jsx'),
  'utf8',
);
const evidence = JSON.parse(fs.readFileSync(
  path.join(root, 'docs/vnext/evidence/camera-navigation/camera-navigation-review.json'),
  'utf8',
));

describe('vNext production camera navigation', () => {
  it('provides the same direct-manipulation controls from every camera preset', () => {
    expect(preview).toContain('OrbitControls');
    expect(preview).toContain('zoomToCursor');
    expect(preview).toContain('ONE: TOUCH.ROTATE');
    expect(preview).toContain('TWO: TOUCH.DOLLY_PAN');
    expect(preview).toContain('LEFT: MOUSE.ROTATE');
    expect(preview).toContain('RIGHT: MOUSE.PAN');
    expect(preview).toContain('onStart={onManualControl}');

    expect(evidence.allPresetFreeLook.map(({ camera }) => camera)).toEqual([
      'Broadcast',
      'Overhead',
      'Bench',
      'Role',
    ]);
    for (const result of evidence.allPresetFreeLook) {
      expect(result).toMatchObject({
        cameraControl: 'free-look',
        replayTimeSeconds: 4.6,
        playerCount: 12,
      });
    }
  });

  it('exposes accessible follow, reframe, zoom, and responsive full-screen controls', () => {
    for (const label of [
      'Follow the action',
      'Recenter selected camera angle',
      'Zoom out',
      'Zoom in',
      'View 3D replay full screen',
    ]) {
      expect(preview).toContain(label);
    }
    expect(preview).toContain("data-camera-control={cameraFollowing ? 'follow' : 'free-look'}");
    expect(preview).toContain('document.fullscreenEnabled');
    expect(preview).toContain('requestFullscreen');
  });

  it('keeps keyboard camera work isolated from replay phase and time shortcuts', () => {
    expect(evidence.keyboard).toMatchObject({
      commandsExercised: ['orbit-left', 'pan-forward', 'zoom-in'],
      cameraControlAfter: 'free-look',
      replayTimeSeconds: 4.6,
      urlStatePreserved: true,
    });
    expect(evidence.keyboard.interactionCountAfter).toBeGreaterThan(
      evidence.keyboard.interactionCountBefore,
    );
    expect(preview).toContain('event.stopPropagation()');
  });

  it('records nonblank desktop, laptop, tablet, and mobile evidence', () => {
    for (const [device, result] of Object.entries(evidence.devices)) {
      expect(result).toMatchObject({
        playerCount: 12,
        canvasCount: 1,
        horizontalOverflow: false,
      });
      const screenshot = path.join(
        root,
        'docs/vnext/evidence/camera-navigation',
        result.screenshot,
      );
      expect(fs.statSync(screenshot).size, device).toBeGreaterThan(30_000);
    }
    expect(evidence.devices.mobile.operatorAndStateControlsOverlap).toBe(false);
    expect(evidence.devices.tablet.stableNorthSouthOrientation).toBe(true);
    expect(evidence.browserErrors).toEqual([]);
  });
});
