import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const playViewer = readFileSync(new URL('./PlayViewer.jsx', import.meta.url), 'utf8');
const playback = readFileSync(new URL('./PlaybackControls.jsx', import.meta.url), 'utf8');
const strategy = readFileSync(new URL('./TacticsLearn.jsx', import.meta.url), 'utf8');
const playmaker = readFileSync(new URL('../playmaker/PlaymakerWorkspace.jsx', import.meta.url), 'utf8');
const playmakerCourt = readFileSync(new URL('../playmaker/PlaymakerCourt.jsx', import.meta.url), 'utf8');
const playmaker3d = readFileSync(new URL('../playmaker/Playmaker3DPreview.jsx', import.meta.url), 'utf8');
const production3d = readFileSync(new URL('./vnext3d/ProductionReplayPreview.jsx', import.meta.url), 'utf8');
const tactical3d = readFileSync(new URL('../tactical3d/TacticalReplayPreview.jsx', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../../scripts/capture-mobile-product-audit.mjs', import.meta.url), 'utf8');

describe('mobile product hardening contracts', () => {
  it('keeps mobile play coaching in flow and exposes view tools in the team-plan sheet', () => {
    expect(playViewer).toContain('play-mobile-view-tools');
    expect(playViewer).toContain('team plan and view tools');
    expect(css).toContain('.play-bottom-sheet.is-open');
    expect(css).toMatch(/\.play-bottom-sheet\.is-open\s*\{[^}]*position:\s*relative/s);
  });

  it('keeps the complete strategy rink ahead of optional coaching detail', () => {
    expect(strategy).toContain('data-mobile-strategy-rink');
    expect(strategy).toContain('<details className="tactics-mobile-coaching">');
    expect(css).toContain('width: min(75vw, 330px)');
    expect(css).toContain('width: min(74vw, 290px)');
    expect(css).toContain('.tactics-phase-dot');
  });

  it('clamps mobile phase targets inside the timeline while preserving their exact phase value', () => {
    expect(playback).toContain("'--playback-marker-position': `${markerPosition}%`");
    expect(css).toContain('left: clamp(20px, var(--playback-marker-position), calc(100% - 20px))');
    expect(css).toMatch(/\.playback-phase-markers button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
    expect(css).toMatch(/\.playback-phase-markers button\.is-active\s*\{\s*background:\s*transparent;/);
  });

  it('gives Create readable identity fields and explicit spatial drag geometry', () => {
    expect(playmaker).toContain('<textarea');
    expect(playmaker).toContain('aria-label="Play purpose"');
    expect(playmakerCourt).toContain('className="playmaker-player-hit-target" r="8.5"');
    expect(playmaker3d).toContain("useState('broadcast')");
  });

  it('keeps named replay navigation and camera controls available in every 3D workspace', () => {
    expect(production3d).toContain("key === 'a'");
    expect(tactical3d).toContain("key === 'a'");
    expect(playmaker3d).toContain('cameraGestureMode={cameraGestureMode}');
    expect(playmaker3d).toContain('tabIndex={0}');
    expect(playmaker3d).toContain('className="playmaker-fullscreen-moment-nav"');
    expect(playmaker3d).toContain('aria-label="Previous moment"');
    expect(playmaker3d).toContain('aria-label="Next moment"');
  });

  it('fails the hidden browser audit for undersized controls, blank 3D, and incomplete strategy rinks', () => {
    expect(audit).toContain('conventional controls are smaller than 40px');
    expect(audit).toContain('the 3D canvas is blank or has not rendered');
    expect(audit).toContain('the strategy rink is not fully visible');
    expect(audit).toContain('a spatial player control is missing its enlarged drag target');
    expect(audit).toContain("visibleBrowserWindowOpened: false");
  });
});
