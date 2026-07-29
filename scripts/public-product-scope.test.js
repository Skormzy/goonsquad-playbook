import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('public product scope', () => {
  it('does not route or import the retired Skills surface', () => {
    const app = read('src/App.jsx');
    const header = read('src/components/Header.jsx');
    const context = read('src/context/AppContext.jsx');

    expect(app).not.toContain('SkillsModule');
    expect(app).not.toContain("activeView === 'skills'");
    expect(header).not.toContain("id: 'skills'");
    expect(context).not.toContain("'skills'");
  });

  it('presents tactical principles as Strategy in primary navigation', () => {
    const header = read('src/components/Header.jsx');

    expect(header).toContain('<WorkspaceSwitcher');
    expect(header).toContain('onContentChange={switchContent}');
    expect(header).toContain('onModeChange={switchMode}');
  });

  it('loads rig review only behind the development boundary', () => {
    const app = read('src/App.jsx');
    const context = read('src/context/AppContext.jsx');

    expect(app).toContain('const PlayerRigReviewView = import.meta.env.DEV');
    expect(app).toContain("import.meta.env.DEV && PlayerRigReviewView && activeView === 'rigreview'");
    expect(context).toContain('includeInternal: import.meta.env.DEV');
  });

  it('keeps the rejected legacy athlete renderer out of the public vNext route', () => {
    const app = read('src/App.jsx');
    const vnext3d = read('src/components/vnext3d/VNextThreeDView.jsx');

    expect(app).toContain("import('./components/vnext3d/VNextThreeDView')");
    expect(app).not.toContain("import('./components/replay3d/ThreeDReplayView')");
    expect(vnext3d).not.toContain('ReplayCanvas');
    expect(vnext3d).not.toContain('ReplayPlayer');
    expect(vnext3d).not.toContain('ReplayCourt');
    expect(vnext3d).toContain('const TacticalReplayPreview = import.meta.env.DEV');
    expect(vnext3d).toContain("lazy(() => import('../../tactical3d/TacticalReplayPreview'))");
  });

  it('keeps rejected athlete binaries out of the public asset directory', () => {
    const publicPlayers = path.join(root, 'public', 'models', 'players');
    const files = fs.existsSync(publicPlayers)
      ? fs.readdirSync(publicPlayers, { recursive: true }).map((file) => path.basename(String(file)))
      : [];
    expect(files).not.toEqual(expect.arrayContaining([
      'animated-runner.glb',
      'goon-player.glb',
      'goon-runner-away.glb',
      'goon-runner-home.glb',
    ]));
  });
});
