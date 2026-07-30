import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const appContext = readFileSync(new URL('../context/AppContext.jsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('./Header.jsx', import.meta.url), 'utf8');
const mobileBottomNav = readFileSync(new URL('./MobileBottomNav.jsx', import.meta.url), 'utf8');
const mobileViewModeSwitch = readFileSync(new URL('./MobileViewModeSwitch.jsx', import.meta.url), 'utf8');
const profileCss = readFileSync(new URL('../profile/profile.css', import.meta.url), 'utf8');
const playViewer = readFileSync(new URL('./PlayViewer.jsx', import.meta.url), 'utf8');
const phaseControls = readFileSync(new URL('./PhaseControls.jsx', import.meta.url), 'utf8');
const playback = readFileSync(new URL('./PlaybackControls.jsx', import.meta.url), 'utf8');
const strategy = readFileSync(new URL('./TacticsLearn.jsx', import.meta.url), 'utf8');
const playmaker = readFileSync(new URL('../playmaker/PlaymakerWorkspace.jsx', import.meta.url), 'utf8');
const playmakerCourt = readFileSync(new URL('../playmaker/PlaymakerCourt.jsx', import.meta.url), 'utf8');
const playmaker3d = readFileSync(new URL('../playmaker/Playmaker3DPreview.jsx', import.meta.url), 'utf8');
const production3d = readFileSync(new URL('./vnext3d/ProductionReplayPreview.jsx', import.meta.url), 'utf8');
const tactical3d = readFileSync(new URL('../tactical3d/TacticalReplayPreview.jsx', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../../scripts/capture-mobile-product-audit.mjs', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../../public/manifest.json', import.meta.url), 'utf8'));
const serviceWorker = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const pwaPrecache = readFileSync(new URL('../../scripts/inject-pwa-precache.mjs', import.meta.url), 'utf8');
const publicBuildCheck = readFileSync(new URL('../../scripts/check-public-build.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('mobile product hardening contracts', () => {
  it('keeps portrait coaching collapsed, fills short landscape, and exposes view tools in a rink overlay', () => {
    expect(playViewer).toContain('play-mobile-view-tools');
    expect(playViewer).toContain('team plan and view tools');
    expect(playViewer).toContain('className="play-mobile-library-trigger"');
    expect(playViewer).toContain("aria-label={sidebarOpen ? 'Hide play library' : 'Open play library'}");
    expect(css).toMatch(/\.play-library-backdrop\s*\{[^}]*z-index:\s*219;/s);
    expect(playViewer).toContain("sheetOpen ? 'is-coaching-open' : ''");
    expect(playViewer).toContain('useState(false)');
    expect(playViewer).toContain('const syncSheet = () => setSheetOpen(query.matches)');
    expect(playViewer).toContain('syncSheet();');
    expect(css).toContain('.play-bottom-sheet.is-open');
    expect(css).toContain('.play-workspace-mobile.is-coaching-open');
    expect(css).toContain('Rink HUD: the tactical surface owns the mobile viewport');
    expect(css).toMatch(/\.play-bottom-sheet,\s*\.play-workspace-mobile\.is-coaching-open \.play-bottom-sheet\s*\{[^}]*position:\s*absolute/s);
  });

  it('keeps the complete strategy rink ahead of optional coaching detail', () => {
    expect(strategy).toContain('data-mobile-strategy-rink');
    expect(strategy).toContain('<details className="tactics-mobile-browser">');
    expect(strategy).toContain('aria-label="Browse strategy principles"');
    expect(strategy).toContain('<details className="tactics-mobile-coaching">');
    expect(css).toContain('width: min(75vw, 330px)');
    expect(css).toContain('width: min(73vw, 290px)');
    expect(css).toContain('.tactics-mobile-browser > summary');
    expect(css).toContain('.tactics-mobile-browser:not([open]) > :not(summary)');
    expect(css).toContain('.tactics-phase-dot');
  });

  it('keeps strategy teaching on the coaching rail at desktop and on-rink at compact sizes', () => {
    expect(strategy).toContain('{!isDesktop && <ReplayTeachingCue accent={tabAccent} />}');
    expect(css).toContain('.tactics-coaching-column');
    expect(css).toContain('border-left: 4px solid var(--gs-cyan)');
  });

  it('keeps the desktop strategy command deck and complete phase rail above a viewport-contained rink', () => {
    const commandIndex = strategy.indexOf('tactics-desktop-command-row');
    const transportIndex = strategy.indexOf('tactics-desktop-transport');
    const rinkIndex = strategy.indexOf('tactics-desktop-rink');
    const legendIndex = strategy.indexOf('tactics-desktop-legend');

    expect(commandIndex).toBeGreaterThan(-1);
    expect(transportIndex).toBeGreaterThan(commandIndex);
    expect(rinkIndex).toBeGreaterThan(transportIndex);
    expect(legendIndex).toBeGreaterThan(rinkIndex);
    expect(css).toContain('Desktop strategy console');
    expect(css).toMatch(/\.tactics-learn\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden !important;/s);
    expect(css).toMatch(/\.tactics-desktop-transport \.playback-phase-rail button > strong\s*\{[^}]*text-overflow:\s*clip;[^}]*white-space:\s*normal;/s);
    expect(css).toMatch(/\.tactics-desktop-rink \.tactics-rink\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
    expect(css).toMatch(/\.tactics-desktop-rink \.tactics-rink > svg\s*\{[^}]*width:\s*100% !important;[^}]*height:\s*100% !important;/s);
    expect(css).toContain('.tactics-desktop-legend .tactics-legend');
  });

  it('uses concise strategy phase names without discarding the complete coaching caption', () => {
    expect(appContext).toContain('function strategyPhaseTitle');
    expect(appContext).toContain('t: strategyPhaseTitle(phase, index)');
    expect(appContext).toContain('desc: phase.caption');
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
    expect(playmaker).toContain('bodyRef.current.scrollTop = 0');
    expect(playmakerCourt).toContain('className="playmaker-player-hit-target" r="8.5"');
    expect(playmaker3d).toContain("workspaceLayout === 'mobile' ? 'overhead' : 'broadcast'");
    expect(css).toContain(".playmaker-workspace[data-view-mode='3d'] .playmaker-inspector");
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

  it('uses smooth phase seeking and a rink-first mobile replay shell in both dimensions', () => {
    expect(appContext).toContain('const transitionToPhase = useCallback');
    expect(appContext).toContain('const stepPhase = useCallback');
    expect(appContext).toContain('shouldSkipPhaseTransition');
    expect(playback).toContain('transitionToPhase(nextPhase)');
    expect(playback).toContain('stepPhase(delta)');
    expect(app).toContain("if (e.key === 'ArrowRight') step(1)");
    expect(app).toContain('if (dx < 0) step(1)');
    expect(playback).toContain('aria-label="Jump to replay phase"');
    expect(playViewer).toContain('<PhaseControls compact />');
    expect(phaseControls).toContain('<PlaybackControls compact={compact} />');
    expect(header).toContain("setReplay3dCamera('overhead')");
    expect(header).toContain("'is-mobile-collapsed'");
    expect(header).toContain('app-header-collapse');
    expect(tactical3d).toContain('className="vnext3d-mobile-coaching"');
    expect(tactical3d).toContain('has-strategy-outcome');
    expect(tactical3d).toContain('data-testid="vnext3d-strategy-outcome"');
    expect(tactical3d).toContain('data-testid="vnext3d-mobile-coaching"');
    expect(tactical3d).toContain('vnext3d-mobile-camera-picker');
    expect(tactical3d).toContain('mobileCameraToolsOpen');
    expect(tactical3d).toContain("mobileLayout && !stageFullscreen && replay.kind === 'play'");
    expect(tactical3d).toContain("!mobileLayout && replay.kind === 'play'");
    expect(css).toContain('Mobile replay final containment overrides');
    expect(css).toContain('bottom: calc(140px + env(safe-area-inset-bottom));');
    expect(css).toMatch(/\.play-workspace-mobile\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
    expect(css).toContain('.vnext3d-mobile-coaching:not([open]) > :not(summary)');
  });

  it('provides an installed-app shell with safe-area navigation and compact mobile utilities', () => {
    expect(app).toContain('<MobileBottomNav />');
    expect(app).not.toContain("height: '100vh'");
    expect(mobileBottomNav).toContain('aria-label="Main app navigation"');
    expect(mobileBottomNav).toContain('data-testid="mobile-bottom-nav"');
    expect(mobileBottomNav).toContain('window.history.pushState');
    expect(mobileBottomNav).not.toContain('mobile-bottom-nav-mode');
    expect(mobileViewModeSwitch).toContain('aria-label="Choose rink view"');
    expect(mobileViewModeSwitch).toContain('aria-label={`Open ${label} rink view`}');
    expect(mobileViewModeSwitch).toContain("setReplay3dCamera('overhead')");
    expect(playViewer).toContain('<MobileViewModeSwitch />');
    expect(tactical3d).toContain('<MobileViewModeSwitch className="is-three-d-stage" />');
    expect(appContext).toContain("window.addEventListener('popstate'");
    expect(mobileBottomNav.match(/content: '(stats|plays|strategy|playmaker)'/g)).toHaveLength(4);
    expect(header).toContain('className="app-header-more"');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('height: 100dvh');
    expect(css).toContain('min-height: 100svh');
    expect(css).toMatch(/\.app-shell\s*\{[^}]*--mobile-bottom-nav-height:[^}]*padding-bottom:\s*var\(--mobile-bottom-nav-height\);/s);
    expect(css).toMatch(/\.mobile-bottom-nav\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;[^}]*height:\s*var\(--mobile-bottom-nav-height\);/s);
    expect(audit).toContain("profile: { content: 'profile', mode: '2d' }");
    expect(audit).toContain("'member-profile-route'");
    expect(audit).toContain("'account-direct-route'");
    expect(audit).toContain('member profile route: Plays navigation did not leave the profile workspace');
    expect(audit).toContain('account route: Home navigation did not leave the account workspace');
    expect(profileCss).toMatch(/@media \(max-height:\s*520px\) and \(orientation:\s*landscape\)\s*\{[^}]*\.profile-gate button\s*\{\s*min-height:\s*44px;/s);
  });

  it('ships installable PWA metadata, icons, and a production service worker', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.display_override).toContain('standalone');
    expect(manifest.orientation).toBe('any');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.some(({ sizes }) => sizes === '192x192')).toBe(true);
    expect(manifest.icons.some(({ sizes }) => sizes === '512x512')).toBe(true);
    expect(manifest.icons.some(({ purpose }) => purpose?.includes('maskable'))).toBe(true);
    expect(manifest.icons.every(({ src }) => (
      src.includes('goonsquad-icon') && src.includes('-v2-')
    ))).toBe(true);
    expect(manifest.description).toContain('Goon with the squad');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('goonsquad-apple-touch-icon-v2.png');
    expect(html).toContain('goonsquad-favicon-v2-32.png');
    expect(html).toContain('property="og:title" content="Goon with the squad"');
    expect(html).toContain('goonsquad-social-card-v2.png');
    expect(main).toContain("navigator.serviceWorker.register('/sw.js', { scope: '/' })");
    expect(serviceWorker).toContain("self.addEventListener('fetch'");
    expect(serviceWorker).toContain('PRECACHE_ASSETS');
    expect(serviceWorker).toContain("contentType.includes('text/html')");
    expect(pwaPrecache).toContain('BUILD_ASSETS');
    expect(packageJson.scripts.build).toContain('inject-pwa-precache.mjs');
    expect(publicBuildCheck).toContain('production asset manifest');
  });

  it('fails the hidden installed-app audit for undersized controls, dead space, blank 3D, and buried transport', () => {
    expect(audit).toContain('conventional controls are smaller than 40px');
    expect(audit).toContain('the 3D canvas is blank or has not rendered');
    expect(audit).toContain('the strategy rink is not fully visible');
    expect(audit).toContain('strategy playback is not available before the bottom navigation');
    expect(audit).toContain('unused space above navigation');
    expect(audit).toContain('the Create inspector crowds the 3D preview');
    expect(audit).toContain('a spatial player control is missing its enlarged drag target');
    expect(audit).toContain('standaloneDisplayModeEmulated');
    expect(audit).toContain('standaloneDisplayModeRequested');
    expect(audit).toContain('standaloneMediaMatched');
    expect(audit).toContain('the 2D timeline covers');
    expect(audit).toContain('the 3D transport is not available above mobile navigation in landscape');
    expect(audit).toContain('strategy outcome and team responsibilities overlap');
    expect(audit).toContain('the expanded 3D team plan leaves the viewport');
    expect(audit).toContain('auditPwaInstallability');
    expect(audit).toContain("visibleBrowserWindowOpened: false");
  });
});
