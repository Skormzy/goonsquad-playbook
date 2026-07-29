import { describe, expect, it } from 'vitest';
import { REPLAY_CANVAS_RENDER_PROFILE } from './ReplayCanvas';

describe('ReplayCanvas render profile', () => {
  it('keeps replay shadows disabled so players read as floor-planted instead of floating', () => {
    expect(REPLAY_CANVAS_RENDER_PROFILE.shadowsEnabled).toBe(false);
    expect(REPLAY_CANVAS_RENDER_PROFILE.contactShadowsEnabled).toBe(false);
    expect(REPLAY_CANVAS_RENDER_PROFILE.shadowCastingLights).toBe(false);
  });
});
