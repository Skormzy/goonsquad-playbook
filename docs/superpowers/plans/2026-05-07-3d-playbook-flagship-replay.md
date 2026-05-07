# 3D Playbook Flagship Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first realistic, deterministic 3D replay for the Goon Squad Standard Breakout, linked to the Breakout Patterns tactic.

**Architecture:** Add a focused `src/replay3d` domain layer for replay data, coordinate mapping, timeline sampling, and deterministic ball-board physics. Add `src/components/replay3d` for the React Three Fiber viewer, keeping high-frequency replay sampling inside the scene loop and normal controls in React UI.

**Tech Stack:** Vite, React, Three.js, React Three Fiber, Drei, Vitest, existing Goon Squad play/tactic data, GLB/glTF production asset convention.

---

## Working Analogy

Treat the current 2D playbook like the coach's whiteboard. This plan builds the first finished training-film scene. The 3D replay is not a game where players improvise. It is a locked scene: the players run the same route, the ball bounces the same way, and the user can watch from different cameras.

## Scope

Implement one flagship 3D replay:

- Play: `brk` Standard Breakout.
- Tactic: `breakout-patterns`.
- No audio.
- No full replay editor.
- No conversion of all plays yet.
- Keep the existing 2D playbook and tactics working.

## File Structure

- Modify: `package.json`
  - Add test scripts and Vitest.
- Create: `src/replay3d/coords.js`
  - Convert existing 0-100 rink coordinates into 3D meters.
- Create: `src/replay3d/physics/boardBall.js`
  - Deterministic board rebound and rolling path helpers.
- Create: `src/replay3d/timeline.js`
  - Sample player positions, ball positions, captions, and camera markers at a replay time.
- Create: `src/replay3d/data/standardBreakout3d.js`
  - Authored flagship replay data.
- Create: `src/replay3d/data/validateReplay.js`
  - Replay schema and ball hockey constraints.
- Create: `src/replay3d/assets/replayAssetManifest.js`
  - Stable model/material keys and fallback asset rules.
- Create: `src/replay3d/__tests__/coords.test.js`
- Create: `src/replay3d/__tests__/boardBall.test.js`
- Create: `src/replay3d/__tests__/validateReplay.test.js`
- Create: `src/replay3d/__tests__/timeline.test.js`
- Create: `src/components/replay3d/ThreeDReplayView.jsx`
- Create: `src/components/replay3d/ReplayCanvas.jsx`
- Create: `src/components/replay3d/Court3D.jsx`
- Create: `src/components/replay3d/ReplayPlayer.jsx`
- Create: `src/components/replay3d/ReplayBall.jsx`
- Create: `src/components/replay3d/ReplayCameraRig.jsx`
- Create: `src/components/replay3d/ReplayControls.jsx`
- Create: `src/components/replay3d/replayStyles.js`
- Modify: `src/App.jsx`
  - Lazy-load the 3D replay view.
- Modify: `src/components/Header.jsx`
  - Add a `3D` tab and pause existing playback on view switch.
- Modify: `src/context/AppContext.jsx`
  - Add selected 3D replay camera state.

## Task 1: Add Test Harness

**Files:**
- Modify: `package.json`
- Create: `src/replay3d/__tests__/coords.test.js`

- [ ] **Step 1: Install Vitest**

Run:

```powershell
npm install -D vitest --legacy-peer-deps
```

Expected: `package.json` and `package-lock.json` gain `vitest` in dev dependencies.

- [ ] **Step 2: Add test scripts**

In `package.json`, add these scripts while preserving existing scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Write the first failing coordinate test**

Create `src/replay3d/__tests__/coords.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { rinkToWorld, WORLD_RINK } from '../coords';

describe('rinkToWorld', () => {
  it('places our net at negative Z and their net at positive Z', () => {
    const ourNet = rinkToWorld({ x: 50, y: 6 });
    const theirNet = rinkToWorld({ x: 50, y: 94 });

    expect(ourNet.x).toBeCloseTo(0, 5);
    expect(ourNet.z).toBeLessThan(-WORLD_RINK.lengthM * 0.35);
    expect(theirNet.x).toBeCloseTo(0, 5);
    expect(theirNet.z).toBeGreaterThan(WORLD_RINK.lengthM * 0.35);
  });

  it('maps left and right boards to stable world edges', () => {
    const left = rinkToWorld({ x: 0, y: 50 });
    const right = rinkToWorld({ x: 100, y: 50 });

    expect(left.x).toBeCloseTo(-WORLD_RINK.widthM / 2, 5);
    expect(right.x).toBeCloseTo(WORLD_RINK.widthM / 2, 5);
    expect(left.z).toBeCloseTo(0, 5);
    expect(right.z).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```powershell
npm test -- src/replay3d/__tests__/coords.test.js
```

Expected: FAIL because `src/replay3d/coords.js` does not exist.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json src/replay3d/__tests__/coords.test.js
git commit -m "test: add replay3d test harness"
```

## Task 2: Coordinate Mapping

**Files:**
- Create: `src/replay3d/coords.js`
- Test: `src/replay3d/__tests__/coords.test.js`

- [ ] **Step 1: Implement coordinate mapping**

Create `src/replay3d/coords.js`:

```js
export const WORLD_RINK = {
  widthM: 18,
  lengthM: 31,
  floorY: 0,
  boardHeightM: 1.05,
  ourGoalY: 6,
  theirGoalY: 94,
};

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function rinkToWorld(point) {
  const xPct = clampPercent(point.x);
  const yPct = clampPercent(point.y);
  const x = (xPct / 100 - 0.5) * WORLD_RINK.widthM;
  const z = (yPct / 100 - 0.5) * WORLD_RINK.lengthM;
  return { x, y: WORLD_RINK.floorY, z };
}

export function worldToRink(point) {
  const x = ((point.x / WORLD_RINK.widthM) + 0.5) * 100;
  const y = ((point.z / WORLD_RINK.lengthM) + 0.5) * 100;
  return { x: clampPercent(x), y: clampPercent(y) };
}

export function faceAngleBetween(from, to) {
  const a = rinkToWorld(from);
  const b = rinkToWorld(to);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function distanceRink(a, b) {
  const aw = rinkToWorld(a);
  const bw = rinkToWorld(b);
  return Math.hypot(bw.x - aw.x, bw.z - aw.z);
}
```

- [ ] **Step 2: Run coordinate tests**

Run:

```powershell
npm test -- src/replay3d/__tests__/coords.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add src/replay3d/coords.js src/replay3d/__tests__/coords.test.js
git commit -m "feat: add 3d rink coordinate mapping"
```

## Task 3: Deterministic Board Bounce Physics

**Files:**
- Create: `src/replay3d/physics/boardBall.js`
- Create: `src/replay3d/__tests__/boardBall.test.js`

- [ ] **Step 1: Write failing board-bounce tests**

Create `src/replay3d/__tests__/boardBall.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { computeBoardBouncePath, samplePolylineByTime } from '../physics/boardBall';

describe('computeBoardBouncePath', () => {
  it('rebounds from the left boards with speed loss', () => {
    const path = computeBoardBouncePath({
      start: { x: 22, y: 13 },
      impact: { x: 4, y: 24 },
      end: { x: 8, y: 42 },
      startTime: 2,
      endTime: 4.5,
      restitution: 0.68,
      rollFriction: 0.16,
    });

    expect(path.points).toHaveLength(3);
    expect(path.points[1].x).toBe(4);
    expect(path.points[1].y).toBe(24);
    expect(path.outSpeed).toBeLessThan(path.inSpeed);
    expect(path.outSpeed).toBeGreaterThan(path.inSpeed * 0.45);
  });

  it('samples the same point for the same replay time', () => {
    const path = computeBoardBouncePath({
      start: { x: 22, y: 13 },
      impact: { x: 4, y: 24 },
      end: { x: 8, y: 42 },
      startTime: 2,
      endTime: 4.5,
      restitution: 0.68,
      rollFriction: 0.16,
    });

    const a = samplePolylineByTime(path, 3.25);
    const b = samplePolylineByTime(path, 3.25);

    expect(a.x).toBeCloseTo(b.x, 5);
    expect(a.y).toBeCloseTo(b.y, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/replay3d/__tests__/boardBall.test.js
```

Expected: FAIL because `boardBall.js` does not exist.

- [ ] **Step 3: Implement deterministic board helpers**

Create `src/replay3d/physics/boardBall.js`:

```js
function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function computeBoardBouncePath({
  start,
  impact,
  end,
  startTime,
  endTime,
  restitution = 0.68,
  rollFriction = 0.16,
}) {
  const duration = Math.max(0.01, endTime - startTime);
  const inDistance = Math.max(0.01, dist(start, impact));
  const outDistance = Math.max(0.01, dist(impact, end));
  const totalWeightedDistance = inDistance + outDistance / Math.max(0.1, restitution);
  const impactTime = startTime + duration * (inDistance / totalWeightedDistance);
  const inSpeed = inDistance / Math.max(0.01, impactTime - startTime);
  const outSpeed = inSpeed * Math.max(0.1, restitution - rollFriction * 0.35);

  return {
    points: [start, impact, end],
    times: [startTime, impactTime, endTime],
    inSpeed,
    outSpeed,
    restitution,
    rollFriction,
  };
}

export function samplePolylineByTime(path, time) {
  const points = path.points;
  const times = path.times;
  if (time <= times[0]) return { ...points[0] };
  if (time >= times[times.length - 1]) return { ...points[points.length - 1] };

  for (let i = 0; i < times.length - 1; i += 1) {
    const aTime = times[i];
    const bTime = times[i + 1];
    if (time >= aTime && time <= bTime) {
      const k = clamp01((time - aTime) / Math.max(0.01, bTime - aTime));
      return {
        x: lerp(points[i].x, points[i + 1].x, k),
        y: lerp(points[i].y, points[i + 1].y, k),
      };
    }
  }

  return { ...points[points.length - 1] };
}

export function sampleCarryPoint({ carrierPoint, offset = { x: 1.2, y: -0.8 } }) {
  return {
    x: carrierPoint.x + offset.x,
    y: carrierPoint.y + offset.y,
  };
}
```

- [ ] **Step 4: Run board physics tests**

Run:

```powershell
npm test -- src/replay3d/__tests__/boardBall.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/replay3d/physics/boardBall.js src/replay3d/__tests__/boardBall.test.js
git commit -m "feat: add deterministic board bounce physics"
```

## Task 4: Replay Data And Validation

**Files:**
- Create: `src/replay3d/data/standardBreakout3d.js`
- Create: `src/replay3d/data/validateReplay.js`
- Create: `src/replay3d/__tests__/validateReplay.test.js`

- [ ] **Step 1: Write failing validation tests**

Create `src/replay3d/__tests__/validateReplay.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { STANDARD_BREAKOUT_3D } from '../data/standardBreakout3d';
import { validateReplay } from '../data/validateReplay';

describe('STANDARD_BREAKOUT_3D', () => {
  it('contains exactly 12 active players', () => {
    const result = validateReplay(STANDARD_BREAKOUT_3D);
    expect(result.errors).toEqual([]);
    expect(STANDARD_BREAKOUT_3D.players).toHaveLength(12);
  });

  it('contains a board-assisted outlet event', () => {
    expect(STANDARD_BREAKOUT_3D.ball.events.some((event) => event.type === 'boardPass')).toBe(true);
  });

  it('links to the existing play and tactic', () => {
    expect(STANDARD_BREAKOUT_3D.playId).toBe('brk');
    expect(STANDARD_BREAKOUT_3D.tacticIds).toContain('breakout-patterns');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/replay3d/__tests__/validateReplay.test.js
```

Expected: FAIL because replay data and validation files do not exist.

- [ ] **Step 3: Add replay validator**

Create `src/replay3d/data/validateReplay.js`:

```js
const REQUIRED_TEAMS = new Set(['us', 'opponent']);
const REQUIRED_KINDS = new Set(['runner', 'goalie']);
const REQUIRED_ROLES = new Set(['LW', 'C', 'RW', 'LD', 'RD', 'G']);

export function validateReplay(replay) {
  const errors = [];

  if (!replay?.id) errors.push('Replay id is required.');
  if (!replay?.playId) errors.push('Replay playId is required.');
  if (!Array.isArray(replay?.tacticIds)) errors.push('Replay tacticIds must be an array.');
  if (!Number.isFinite(replay?.duration) || replay.duration <= 0) errors.push('Replay duration must be positive.');
  if (!Array.isArray(replay?.players)) errors.push('Replay players must be an array.');
  if (!Array.isArray(replay?.ball?.events)) errors.push('Replay ball events must be an array.');

  if (Array.isArray(replay?.players)) {
    if (replay.players.length !== 12) errors.push('Replay must include 12 players.');

    const teamRoleCounts = { us: new Set(), opponent: new Set() };
    for (const player of replay.players) {
      if (!player.id) errors.push('Every player requires an id.');
      if (!REQUIRED_TEAMS.has(player.team)) errors.push(`Invalid team for ${player.id}.`);
      if (!REQUIRED_KINDS.has(player.kind)) errors.push(`Invalid kind for ${player.id}.`);
      if (!REQUIRED_ROLES.has(player.role)) errors.push(`Invalid role for ${player.id}.`);
      if (!Array.isArray(player.path) || player.path.length < 2) errors.push(`Player ${player.id} requires at least two path points.`);
      if (teamRoleCounts[player.team]) teamRoleCounts[player.team].add(player.role);
    }

    for (const team of Object.keys(teamRoleCounts)) {
      for (const role of REQUIRED_ROLES) {
        if (!teamRoleCounts[team].has(role)) errors.push(`Team ${team} is missing ${role}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Add Standard Breakout replay data**

Create `src/replay3d/data/standardBreakout3d.js`:

```js
export const STANDARD_BREAKOUT_3D = {
  id: 'standard-breakout-flagship',
  playId: 'brk',
  tacticIds: ['breakout-patterns'],
  title: 'Standard Breakout',
  status: 'draft',
  duration: 10,
  phaseMarkers: [
    { id: 'retrieve', t: 0, label: 'LD retrieves' },
    { id: 'read', t: 2.2, label: 'Read pressure' },
    { id: 'boards', t: 3.2, label: 'Board outlet' },
    { id: 'exit', t: 6.2, label: 'Exit shape' },
  ],
  captions: [
    { t: 0, text: 'LD retrieves behind our net while support players open lanes.' },
    { t: 2.2, text: 'LW runs the boards, C shows middle, RW stretches wide, RD supports.' },
    { t: 3.2, text: 'The board outlet uses the boards to get around pressure.' },
    { t: 6.2, text: 'All five move together through the breakout shape.' },
  ],
  players: [
    {
      id: 'us-LW', team: 'us', role: 'LW', kind: 'runner', asset: 'homeRunner',
      path: [{ t: 0, x: 8, y: 35 }, { t: 2.2, x: 8, y: 42 }, { t: 5, x: 8, y: 50 }, { t: 10, x: 14, y: 62 }],
    },
    {
      id: 'us-C', team: 'us', role: 'C', kind: 'runner', asset: 'homeRunner',
      path: [{ t: 0, x: 50, y: 28 }, { t: 2.2, x: 42, y: 34 }, { t: 5, x: 38, y: 43 }, { t: 10, x: 45, y: 58 }],
    },
    {
      id: 'us-RW', team: 'us', role: 'RW', kind: 'runner', asset: 'homeRunner',
      path: [{ t: 0, x: 88, y: 34 }, { t: 2.2, x: 85, y: 42 }, { t: 5, x: 82, y: 52 }, { t: 10, x: 76, y: 64 }],
    },
    {
      id: 'us-LD', team: 'us', role: 'LD', kind: 'runner', asset: 'homeRunner',
      path: [{ t: 0, x: 35, y: 3 }, { t: 2.2, x: 22, y: 13 }, { t: 4.5, x: 24, y: 20 }, { t: 10, x: 34, y: 44 }],
    },
    {
      id: 'us-RD', team: 'us', role: 'RD', kind: 'runner', asset: 'homeRunner',
      path: [{ t: 0, x: 60, y: 3 }, { t: 2.2, x: 58, y: 11 }, { t: 5, x: 52, y: 18 }, { t: 10, x: 54, y: 42 }],
    },
    {
      id: 'us-G', team: 'us', role: 'G', kind: 'goalie', asset: 'homeGoalie',
      path: [{ t: 0, x: 50, y: 8 }, { t: 5, x: 49, y: 8 }, { t: 10, x: 50, y: 8 }],
    },
    {
      id: 'opp-LW', team: 'opponent', role: 'LW', kind: 'runner', asset: 'awayRunner',
      path: [{ t: 0, x: 75, y: 30 }, { t: 2.2, x: 70, y: 36 }, { t: 5, x: 62, y: 42 }, { t: 10, x: 58, y: 50 }],
    },
    {
      id: 'opp-C', team: 'opponent', role: 'C', kind: 'runner', asset: 'awayRunner',
      path: [{ t: 0, x: 40, y: 18 }, { t: 2.2, x: 30, y: 22 }, { t: 5, x: 24, y: 30 }, { t: 10, x: 30, y: 44 }],
    },
    {
      id: 'opp-RW', team: 'opponent', role: 'RW', kind: 'runner', asset: 'awayRunner',
      path: [{ t: 0, x: 15, y: 30 }, { t: 2.2, x: 12, y: 34 }, { t: 5, x: 13, y: 40 }, { t: 10, x: 22, y: 50 }],
    },
    {
      id: 'opp-LD', team: 'opponent', role: 'LD', kind: 'runner', asset: 'awayRunner',
      path: [{ t: 0, x: 30, y: 48 }, { t: 2.2, x: 30, y: 52 }, { t: 5, x: 32, y: 56 }, { t: 10, x: 38, y: 64 }],
    },
    {
      id: 'opp-RD', team: 'opponent', role: 'RD', kind: 'runner', asset: 'awayRunner',
      path: [{ t: 0, x: 65, y: 48 }, { t: 2.2, x: 62, y: 52 }, { t: 5, x: 60, y: 56 }, { t: 10, x: 62, y: 64 }],
    },
    {
      id: 'opp-G', team: 'opponent', role: 'G', kind: 'goalie', asset: 'awayGoalie',
      path: [{ t: 0, x: 50, y: 92 }, { t: 5, x: 51, y: 92 }, { t: 10, x: 50, y: 92 }],
    },
  ],
  ball: {
    events: [
      { type: 'carry', from: 0, to: 2.4, carrierId: 'us-LD', offset: { x: -1.4, y: -1.2 } },
      {
        type: 'boardPass',
        from: 2.4,
        to: 4.6,
        start: { x: 22, y: 13 },
        impact: { x: 4, y: 24 },
        end: { x: 8, y: 42 },
        receiverId: 'us-LW',
        restitution: 0.68,
        rollFriction: 0.16,
      },
      { type: 'carry', from: 4.6, to: 10, carrierId: 'us-LW', offset: { x: 1.2, y: 1.0 } },
    ],
  },
  cameras: [
    { id: 'overhead', label: 'Overhead Tactical' },
    { id: 'broadcast', label: 'Broadcast Sideline' },
    { id: 'behind-our-net', label: 'Behind Our Net' },
    { id: 'follow-ball', label: 'Follow Ball' },
    { id: 'orbit', label: 'Free Orbit' },
  ],
};
```

- [ ] **Step 5: Run validation tests**

Run:

```powershell
npm test -- src/replay3d/__tests__/validateReplay.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/replay3d/data/standardBreakout3d.js src/replay3d/data/validateReplay.js src/replay3d/__tests__/validateReplay.test.js
git commit -m "feat: add standard breakout replay data"
```

## Task 5: Replay Timeline Sampler

**Files:**
- Create: `src/replay3d/timeline.js`
- Create: `src/replay3d/__tests__/timeline.test.js`

- [ ] **Step 1: Write failing timeline tests**

Create `src/replay3d/__tests__/timeline.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { STANDARD_BREAKOUT_3D } from '../data/standardBreakout3d';
import { sampleReplayAt } from '../timeline';

describe('sampleReplayAt', () => {
  it('returns 12 sampled players at any replay time', () => {
    const frame = sampleReplayAt(STANDARD_BREAKOUT_3D, 3.4);
    expect(frame.players).toHaveLength(12);
    expect(frame.players.find((p) => p.id === 'us-LD').role).toBe('LD');
  });

  it('returns the board-pass ball between impact and receiver', () => {
    const frame = sampleReplayAt(STANDARD_BREAKOUT_3D, 3.8);
    expect(frame.ball.x).toBeGreaterThanOrEqual(4);
    expect(frame.ball.x).toBeLessThanOrEqual(22);
    expect(frame.activeCaption.text).toContain('board outlet');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/replay3d/__tests__/timeline.test.js
```

Expected: FAIL because `timeline.js` does not exist.

- [ ] **Step 3: Implement timeline sampler**

Create `src/replay3d/timeline.js`:

```js
import { computeBoardBouncePath, sampleCarryPoint, samplePolylineByTime } from './physics/boardBall';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function samplePath(path, time) {
  if (time <= path[0].t) return { x: path[0].x, y: path[0].y };
  if (time >= path[path.length - 1].t) {
    const last = path[path.length - 1];
    return { x: last.x, y: last.y };
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    if (time >= a.t && time <= b.t) {
      const k = clamp((time - a.t) / Math.max(0.01, b.t - a.t), 0, 1);
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
    }
  }

  const fallback = path[path.length - 1];
  return { x: fallback.x, y: fallback.y };
}

function activeCaption(captions, time) {
  let current = captions[0];
  for (const caption of captions) {
    if (caption.t <= time) current = caption;
  }
  return current;
}

function activeBallEvent(events, time) {
  return events.find((event) => time >= event.from && time <= event.to) || events[events.length - 1];
}

export function sampleReplayAt(replay, rawTime) {
  const time = clamp(rawTime, 0, replay.duration);
  const players = replay.players.map((player) => {
    const point = samplePath(player.path, time);
    const lookAheadTime = Math.min(replay.duration, time + 0.1);
    const nextPoint = samplePath(player.path, lookAheadTime);
    const stepDistance = Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y);
    return {
      ...player,
      point,
      time,
      facing: Math.atan2(nextPoint.x - point.x, nextPoint.y - point.y),
      speedMps: stepDistance * 0.31 / Math.max(0.1, lookAheadTime - time),
    };
  });

  const byId = new Map(players.map((player) => [player.id, player]));
  const event = activeBallEvent(replay.ball.events, time);
  let ball;

  if (event.type === 'carry') {
    const carrier = byId.get(event.carrierId);
    ball = sampleCarryPoint({ carrierPoint: carrier.point, offset: event.offset });
  } else if (event.type === 'boardPass') {
    const path = computeBoardBouncePath({
      start: event.start,
      impact: event.impact,
      end: event.end,
      startTime: event.from,
      endTime: event.to,
      restitution: event.restitution,
      rollFriction: event.rollFriction,
    });
    ball = samplePolylineByTime(path, time);
  } else {
    ball = { x: 50, y: 50 };
  }

  return {
    time,
    players,
    ball,
    activeCaption: activeCaption(replay.captions, time),
    phaseMarker: replay.phaseMarkers.filter((marker) => marker.t <= time).at(-1),
  };
}
```

- [ ] **Step 4: Run timeline tests**

Run:

```powershell
npm test -- src/replay3d/__tests__/timeline.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/replay3d/timeline.js src/replay3d/__tests__/timeline.test.js
git commit -m "feat: sample 3d replay timeline"
```

## Task 6: 3D Asset Manifest And Styling Tokens

**Files:**
- Create: `src/replay3d/assets/replayAssetManifest.js`
- Create: `src/components/replay3d/replayStyles.js`

- [ ] **Step 1: Create asset manifest**

Create `src/replay3d/assets/replayAssetManifest.js`:

```js
export const REPLAY_ASSETS = {
  homeRunner: {
    key: 'homeRunner',
    label: 'Goon Squad Runner',
    preferredGlb: '/models/replay3d/goonsquad-runner.glb',
    fallback: 'procedural-runner',
  },
  awayRunner: {
    key: 'awayRunner',
    label: 'Opponent Runner',
    preferredGlb: '/models/replay3d/opponent-runner.glb',
    fallback: 'procedural-runner',
  },
  homeGoalie: {
    key: 'homeGoalie',
    label: 'Goon Squad Goalie',
    preferredGlb: '/models/replay3d/goonsquad-goalie.glb',
    fallback: 'procedural-goalie',
  },
  awayGoalie: {
    key: 'awayGoalie',
    label: 'Opponent Goalie',
    preferredGlb: '/models/replay3d/opponent-goalie.glb',
    fallback: 'procedural-goalie',
  },
};

export function getReplayAsset(key) {
  return REPLAY_ASSETS[key] || REPLAY_ASSETS.homeRunner;
}
```

- [ ] **Step 2: Create replay style tokens**

Create `src/components/replay3d/replayStyles.js`:

```js
export const REPLAY_COLORS = {
  floor: '#c8552d',
  floorDark: '#9f3d22',
  boardWhite: '#f8f8f4',
  kickPlate: '#f6c546',
  blueLine: '#2563eb',
  goalLine: '#dc2626',
  ball: '#f97316',
  homeJersey: '#163b87',
  homeTrim: '#f8b134',
  homeShorts: '#0b1b36',
  awayJersey: '#b91c1c',
  awayTrim: '#f8fafc',
  awayShorts: '#2a0a0a',
  goalieHome: '#16a34a',
  goalieAway: '#dc2626',
};

export const PLAYER_SCALE = {
  runnerHeight: 1.78,
  goalieHeight: 1.72,
  runnerRadius: 0.22,
  goalieWidth: 0.62,
};
```

- [ ] **Step 3: Commit**

```powershell
git add src/replay3d/assets/replayAssetManifest.js src/components/replay3d/replayStyles.js
git commit -m "feat: add replay3d asset manifest"
```

## Task 7: Court, Players, Ball, And Camera Components

**Files:**
- Create: `src/components/replay3d/Court3D.jsx`
- Create: `src/components/replay3d/ReplayPlayer.jsx`
- Create: `src/components/replay3d/ReplayBall.jsx`
- Create: `src/components/replay3d/ReplayCameraRig.jsx`

- [ ] **Step 1: Create the 3D court**

Create `src/components/replay3d/Court3D.jsx`:

```jsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { WORLD_RINK } from '../../replay3d/coords';
import { REPLAY_COLORS } from './replayStyles';

function useCourtTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = REPLAY_COLORS.floor;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(60, 20, 10, 0.32)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      const p = (size / 8) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 9);
    texture.anisotropy = 8;
    return texture;
  }, []);
}

export default function Court3D() {
  const courtTexture = useCourtTexture();
  const w = WORLD_RINK.widthM;
  const l = WORLD_RINK.lengthM;

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial map={courtTexture} roughness={0.85} metalness={0} />
      </mesh>

      <mesh position={[0, 0.012, -l * 0.14]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 0.12]} />
        <meshStandardMaterial color={REPLAY_COLORS.blueLine} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.012, l * 0.14]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 0.12]} />
        <meshStandardMaterial color={REPLAY_COLORS.blueLine} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 0.09]} />
        <meshStandardMaterial color={REPLAY_COLORS.goalLine} roughness={0.6} />
      </mesh>

      <mesh position={[-w / 2, WORLD_RINK.boardHeightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, WORLD_RINK.boardHeightM, l]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.55} />
      </mesh>
      <mesh position={[w / 2, WORLD_RINK.boardHeightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, WORLD_RINK.boardHeightM, l]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.55} />
      </mesh>
      <mesh position={[0, WORLD_RINK.boardHeightM / 2, -l / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, WORLD_RINK.boardHeightM, 0.22]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.55} />
      </mesh>
      <mesh position={[0, WORLD_RINK.boardHeightM / 2, l / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, WORLD_RINK.boardHeightM, 0.22]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.55} />
      </mesh>

      <mesh position={[0, 0.18, -l * 0.44]} castShadow>
        <boxGeometry args={[1.8, 0.36, 0.22]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.18, l * 0.44]} castShadow>
        <boxGeometry args={[1.8, 0.36, 0.22]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.55} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Create procedural player fallback**

Create `src/components/replay3d/ReplayPlayer.jsx`:

```jsx
import { Text } from '@react-three/drei';
import { rinkToWorld } from '../../replay3d/coords';
import { PLAYER_SCALE, REPLAY_COLORS } from './replayStyles';

function RunnerBody({ home, stride = 0 }) {
  const jersey = home ? REPLAY_COLORS.homeJersey : REPLAY_COLORS.awayJersey;
  const trim = home ? REPLAY_COLORS.homeTrim : REPLAY_COLORS.awayTrim;
  const shorts = home ? REPLAY_COLORS.homeShorts : REPLAY_COLORS.awayShorts;

  return (
    <group>
      <mesh castShadow position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.18, 0.78, 8, 16]} />
        <meshStandardMaterial color={jersey} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.24]} />
        <meshStandardMaterial color={shorts} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.14, 18, 14]} />
        <meshStandardMaterial color="#d8a47a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, 0.19]}>
        <boxGeometry args={[0.26, 0.05, 0.025]} />
        <meshStandardMaterial color={trim} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0.28, 0.82, 0.04]} rotation={[0.35 + stride * 0.15, 0, -0.35]}>
        <capsuleGeometry args={[0.055, 0.58, 6, 10]} />
        <meshStandardMaterial color={jersey} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[-0.28, 0.82, 0.04]} rotation={[0.35 - stride * 0.15, 0, 0.35]}>
        <capsuleGeometry args={[0.055, 0.58, 6, 10]} />
        <meshStandardMaterial color={jersey} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0.12, 0.18, 0.04]} rotation={[0.1 + stride * 0.25, 0, -0.08]}>
        <capsuleGeometry args={[0.065, 0.66, 6, 10]} />
        <meshStandardMaterial color={shorts} roughness={0.62} />
      </mesh>
      <mesh castShadow position={[-0.12, 0.18, -0.04]} rotation={[-0.1 - stride * 0.25, 0, 0.08]}>
        <capsuleGeometry args={[0.065, 0.66, 6, 10]} />
        <meshStandardMaterial color={shorts} roughness={0.62} />
      </mesh>
    </group>
  );
}

function GoalieBody({ home }) {
  const color = home ? REPLAY_COLORS.goalieHome : REPLAY_COLORS.goalieAway;
  return (
    <group>
      <mesh castShadow position={[0, 0.82, 0]}>
        <boxGeometry args={[PLAYER_SCALE.goalieWidth, 1.05, 0.34]} />
        <meshStandardMaterial color={color} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.17, 18, 14]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.35, 0.58, 0]}>
        <boxGeometry args={[0.22, 0.66, 0.22]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[-0.35, 0.58, 0]}>
        <boxGeometry args={[0.22, 0.66, 0.22]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function ReplayPlayer({ sampledPlayer, showLabel }) {
  const world = rinkToWorld(sampledPlayer.point);
  const home = sampledPlayer.team === 'us';
  const isGoalie = sampledPlayer.kind === 'goalie';
  const stride = Math.sin((sampledPlayer.time || 0) * Math.max(5, sampledPlayer.speedMps * 3)) * Math.min(1, sampledPlayer.speedMps / 3);

  return (
    <group position={[world.x, world.y, world.z]}>
      <group rotation={[0, sampledPlayer.facing || 0, 0]}>
        {isGoalie ? <GoalieBody home={home} /> : <RunnerBody home={home} stride={stride} />}
      </group>
      {showLabel && (
        <Text
          position={[0, isGoalie ? 2.05 : 1.9, 0]}
          fontSize={0.28}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#111827"
        >
          {sampledPlayer.role}
        </Text>
      )}
    </group>
  );
}
```

- [ ] **Step 3: Create replay ball**

Create `src/components/replay3d/ReplayBall.jsx`:

```jsx
import { rinkToWorld } from '../../replay3d/coords';
import { REPLAY_COLORS } from './replayStyles';

export default function ReplayBall({ point }) {
  const world = rinkToWorld(point);

  return (
    <mesh castShadow position={[world.x, 0.065, world.z]}>
      <sphereGeometry args={[0.065, 24, 18]} />
      <meshStandardMaterial
        color={REPLAY_COLORS.ball}
        emissive={REPLAY_COLORS.ball}
        emissiveIntensity={0.18}
        roughness={0.42}
      />
    </mesh>
  );
}
```

- [ ] **Step 4: Create replay camera rig**

Create `src/components/replay3d/ReplayCameraRig.jsx`:

```jsx
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const CAMERA_PRESETS = {
  overhead: { position: [0, 27, 0.1], lookAt: [0, 0, 0] },
  broadcast: { position: [13, 7, -6], lookAt: [0, 0, -3] },
  'behind-our-net': { position: [0, 3.2, -18], lookAt: [0, 1, -6] },
  'follow-ball': { position: [6, 3.2, -10], lookAt: [0, 0.7, -2] },
  orbit: { position: [9, 8, -13], lookAt: [0, 0.8, 0] },
};

export default function ReplayCameraRig({ cameraId }) {
  const { camera } = useThree();
  const preset = CAMERA_PRESETS[cameraId] || CAMERA_PRESETS.overhead;

  useEffect(() => {
    camera.position.set(...preset.position);
    camera.lookAt(...preset.lookAt);
  }, [camera, preset]);

  if (cameraId !== 'orbit') return null;

  return (
    <OrbitControls
      enablePan={false}
      minDistance={5}
      maxDistance={35}
      target={[0, 0.8, 0]}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}
```

- [ ] **Step 5: Commit**

```powershell
git add src/components/replay3d/Court3D.jsx src/components/replay3d/ReplayPlayer.jsx src/components/replay3d/ReplayBall.jsx src/components/replay3d/ReplayCameraRig.jsx
git commit -m "feat: add replay3d scene primitives"
```

## Task 8: Replay Canvas And Viewer UI

**Files:**
- Create: `src/components/replay3d/ReplayCanvas.jsx`
- Create: `src/components/replay3d/ReplayControls.jsx`
- Create: `src/components/replay3d/ThreeDReplayView.jsx`

- [ ] **Step 1: Create canvas scene**

Create `src/components/replay3d/ReplayCanvas.jsx`:

```jsx
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows, Line } from '@react-three/drei';
import { rinkToWorld } from '../../replay3d/coords';
import Court3D from './Court3D';
import ReplayBall from './ReplayBall';
import ReplayCameraRig from './ReplayCameraRig';
import ReplayPlayer from './ReplayPlayer';

function trailPoints(player) {
  return player.path.map((point) => {
    const world = rinkToWorld(point);
    return [world.x, 0.05, world.z];
  });
}

export default function ReplayCanvas({ replay, frame, cameraId, showTeachingOverlays }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 27, 0.1], fov: 42, near: 0.1, far: 80 }}
      style={{ width: '100%', height: '100%', background: '#111827' }}
    >
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#ffffff', '#2d3348', 0.45]} />
      <directionalLight
        position={[8, 14, -6]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Environment preset="city" />
      <Court3D />
      {showTeachingOverlays && replay.players.filter((player) => player.team === 'us' && player.kind === 'runner').map((player) => (
        <Line key={`trail-${player.id}`} points={trailPoints(player)} color="#f8b134" lineWidth={1.2} transparent opacity={0.35} dashed dashSize={0.35} gapSize={0.18} />
      ))}
      {frame.players.map((player) => (
        <ReplayPlayer key={player.id} sampledPlayer={player} showLabel={showTeachingOverlays} />
      ))}
      <ReplayBall point={frame.ball} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.35} scale={22} blur={2.8} far={5} />
      <ReplayCameraRig cameraId={cameraId} />
    </Canvas>
  );
}
```

- [ ] **Step 2: Create replay controls**

Create `src/components/replay3d/ReplayControls.jsx`:

```jsx
export default function ReplayControls({
  replay,
  time,
  setTime,
  playing,
  setPlaying,
  speed,
  setSpeed,
  cameraId,
  setCameraId,
  showTeachingOverlays,
  setShowTeachingOverlays,
  openPlaybookPlay,
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={() => setPlaying(!playing)} style={{ padding: '7px 12px', borderRadius: 6, fontWeight: 800 }}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <input
        aria-label="Replay timeline"
        type="range"
        min="0"
        max={replay.duration}
        step="0.05"
        value={time}
        onChange={(event) => setTime(Number(event.target.value))}
        style={{ flex: '1 1 180px' }}
      />
      <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={1.5}>1.5x</option>
        <option value={2}>2x</option>
      </select>
      <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
        {replay.cameras.map((camera) => (
          <option key={camera.id} value={camera.id}>{camera.label}</option>
        ))}
      </select>
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
        <input type="checkbox" checked={showTeachingOverlays} onChange={(event) => setShowTeachingOverlays(event.target.checked)} />
        Labels and trails
      </label>
      <button onClick={openPlaybookPlay} style={{ padding: '7px 12px', borderRadius: 6, fontWeight: 700 }}>
        Open 2D Play
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create 3D replay view**

Create `src/components/replay3d/ThreeDReplayView.jsx`:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PLAYS } from '../../data/plays';
import { STANDARD_BREAKOUT_3D } from '../../replay3d/data/standardBreakout3d';
import { sampleReplayAt } from '../../replay3d/timeline';
import ReplayCanvas from './ReplayCanvas';
import ReplayControls from './ReplayControls';

export default function ThreeDReplayView() {
  const {
    replay3dCamera: cameraId,
    setReplay3dCamera: setCameraId,
    setActiveView,
    setCurrentPlay,
    setCurrentPhase,
    setIsPlaying,
  } = useApp();
  const replay = STANDARD_BREAKOUT_3D;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTeachingOverlays, setShowTeachingOverlays] = useState(true);
  const lastRef = useRef(null);

  useEffect(() => {
    if (!playing) {
      lastRef.current = null;
      return undefined;
    }

    let raf = 0;
    const tick = (now) => {
      if (lastRef.current === null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setTime((current) => {
        const next = current + dt * speed;
        if (next >= replay.duration) {
          setPlaying(false);
          return replay.duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, replay.duration, speed]);

  const frame = useMemo(() => sampleReplayAt(replay, time), [replay, time]);
  const openPlaybookPlay = () => {
    const play = PLAYS.find((item) => item.id === replay.playId);
    if (!play) return;
    setCurrentPlay(play);
    setCurrentPhase(0);
    setIsPlaying(false);
    setActiveView('playbook');
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1.5, fontFamily: 'monospace', opacity: 0.7 }}>3D REPLAY</div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{replay.title}</h1>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.75 }}>{time.toFixed(1)}s / {replay.duration.toFixed(1)}s</div>
      </div>

      <div style={{ flex: 1, minHeight: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.35)' }}>
        <ReplayCanvas replay={replay} frame={frame} cameraId={cameraId} showTeachingOverlays={showTeachingOverlays} />
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.25)' }}>
        <ReplayControls
          replay={replay}
          time={time}
          setTime={setTime}
          playing={playing}
          setPlaying={setPlaying}
          speed={speed}
          setSpeed={setSpeed}
          cameraId={cameraId}
          setCameraId={setCameraId}
          showTeachingOverlays={showTeachingOverlays}
          setShowTeachingOverlays={setShowTeachingOverlays}
          openPlaybookPlay={openPlaybookPlay}
        />
        <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 12, color: '#f97316' }}>
          {frame.activeCaption.text}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```powershell
git add src/components/replay3d/ReplayCanvas.jsx src/components/replay3d/ReplayControls.jsx src/components/replay3d/ThreeDReplayView.jsx
git commit -m "feat: add 3d replay viewer"
```

## Task 9: App Integration

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Header.jsx`
- Modify: `src/context/AppContext.jsx`

- [ ] **Step 1: Add 3D camera state to context**

In `src/context/AppContext.jsx`, add:

```jsx
const [replay3dCamera, setReplay3dCamera] = useState('overhead');
```

Expose these values in the provider object:

```jsx
replay3dCamera, setReplay3dCamera,
```

- [ ] **Step 2: Lazy-load the 3D replay view**

In `src/App.jsx`, add:

```jsx
const ThreeDReplayView = lazy(() => import('./components/replay3d/ThreeDReplayView'));
```

Add a new `AnimatePresence` branch:

```jsx
{activeView === 'replay3d' && (
  <motion.div
    key="replay3d"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
  >
    <Suspense fallback={
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' }}>
        LOADING 3D REPLAY...
      </div>
    }>
      <ThreeDReplayView />
    </Suspense>
  </motion.div>
)}
```

- [ ] **Step 3: Add header tab**

In `src/components/Header.jsx`, update `switchView`:

```jsx
if (view === 'tactics' || view === 'skills' || view === 'replay3d') setSidebarOpen(false);
```

Update the tab array:

```jsx
[
  { id: 'playbook', label: 'PLAYS' },
  { id: 'tactics',  label: 'TACTICS' },
  { id: 'replay3d', label: '3D' },
  { id: 'skills',   label: 'SKILLS' },
]
```

- [ ] **Step 4: Run app checks**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected:

- Tests PASS.
- Lint PASS.
- Build PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/App.jsx src/components/Header.jsx src/context/AppContext.jsx
git commit -m "feat: integrate 3d replay view"
```

## Task 10: Asset Upgrade Pass

**Files:**
- Add after asset sourcing: `public/models/replay3d/goonsquad-runner.glb`
- Add after asset sourcing: `public/models/replay3d/opponent-runner.glb`
- Add after asset sourcing: `public/models/replay3d/goonsquad-goalie.glb`
- Add after asset sourcing: `public/models/replay3d/opponent-goalie.glb`
- Modify: `src/components/replay3d/ReplayPlayer.jsx`

- [ ] **Step 1: Create asset directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path public\models\replay3d
```

- [ ] **Step 2: Add approved GLB assets**

Place optimized assets at these exact paths:

```text
public/models/replay3d/goonsquad-runner.glb
public/models/replay3d/opponent-runner.glb
public/models/replay3d/goonsquad-goalie.glb
public/models/replay3d/opponent-goalie.glb
```

Asset requirements:

- GLB or glTF 2.0 source.
- Consistent real-world scale.
- Feet origin at floor level.
- Forward direction documented during export.
- Team uniforms visible from broadcast and overhead camera.
- Goon Squad home colors applied to the home runner and goalie.
- Opponent colors distinct from home colors.
- Mobile-safe texture sizes.
- Runner GLBs include animation clips named `idle`, `run`, `pass`, and `receive`.
- Goalie GLBs include animation clips named `goalie-ready` and `goalie-shift`.

- [ ] **Step 3: Replace fallback body with GLB loader when assets exist**

In `src/components/replay3d/ReplayPlayer.jsx`, add:

```jsx
import { useEffect, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { getReplayAsset } from '../../replay3d/assets/replayAssetManifest';
```

Add this component above `ReplayPlayer`:

```jsx
function GlbPlayer({ assetKey, isGoalie, moving }) {
  const group = useRef();
  const asset = getReplayAsset(assetKey);
  const gltf = useGLTF(asset.preferredGlb);
  const { actions } = useAnimations(gltf.animations, group);
  const clipName = isGoalie ? (moving ? 'goalie-shift' : 'goalie-ready') : (moving ? 'run' : 'idle');

  useEffect(() => {
    const action = actions[clipName];
    if (!action) return undefined;
    action.reset().fadeIn(0.15).play();
    return () => action.fadeOut(0.15);
  }, [actions, clipName]);

  return <primitive ref={group} object={gltf.scene.clone(true)} />;
}
```

Replace the body render inside `ReplayPlayer` with:

```jsx
<group rotation={[0, sampledPlayer.facing || 0, 0]}>
  {sampledPlayer.asset ? (
    <GlbPlayer assetKey={sampledPlayer.asset} isGoalie={isGoalie} moving={(sampledPlayer.speedMps || 0) > 0.25} />
  ) : isGoalie ? (
    <GoalieBody home={home} />
  ) : (
    <RunnerBody home={home} stride={stride} />
  )}
</group>
```

- [ ] **Step 4: Verify build with assets**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add public/models/replay3d src/components/replay3d/ReplayPlayer.jsx
git commit -m "feat: add replay3d player assets"
```

## Task 11: Responsive QA And Visual Verification

**Files:**
- Modify only files that fail QA from earlier tasks.

- [ ] **Step 1: Start dev server**

Run:

```powershell
npm run dev
```

Expected: Vite prints a local URL.

- [ ] **Step 2: Desktop QA**

Open the app at the Vite URL and switch to `3D`.

Verify:

- Standard Breakout loads.
- 12 players are visible.
- Both goalies are visible.
- Our net is at the bottom.
- Ball visibly travels from LD to the left boards, bounces, and reaches LW.
- Captions remain below the scene.
- Camera selector changes view without changing replay time.

- [ ] **Step 3: Tablet/mobile QA**

Use browser responsive sizes:

```text
390 x 844
768 x 1024
1366 x 768
```

Verify:

- Controls wrap without overlapping.
- Scene remains usable.
- Captions are readable.
- Camera controls are reachable.
- The ball remains visible during the board outlet.

- [ ] **Step 4: Full verification**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected:

- Tests PASS.
- Lint PASS.
- Build PASS.

- [ ] **Step 5: Commit fixes**

If QA required fixes:

```powershell
git add src/components/replay3d src/replay3d src/App.jsx src/components/Header.jsx src/context/AppContext.jsx
git commit -m "fix: polish flagship 3d replay qa"
```

If no fixes were required, do not create an empty commit.

## Task 12: Completion Review

**Files:**
- Modify: `docs/superpowers/specs/2026-05-07-3d-playbook-flagship-replay-design.md` only if the implementation changed approved scope.

- [ ] **Step 1: Compare implementation to design**

Review:

```text
docs/superpowers/specs/2026-05-07-3d-playbook-flagship-replay-design.md
```

Confirm:

- Standard Breakout is the only flagship replay.
- No audio was added.
- The replay is deterministic.
- Board bounce is visible.
- Existing 2D playbook still works.
- All player movement uses ball hockey language and running movement.

- [ ] **Step 2: Final commands**

Run:

```powershell
git status --short
npm test
npm run lint
npm run build
```

Expected:

- Only intentional changes are present.
- Tests PASS.
- Lint PASS.
- Build PASS.

- [ ] **Step 3: Final handoff summary**

Report:

- Files changed.
- Replay behavior implemented.
- Verification commands and results.
- Remaining asset-quality gaps, if GLB assets were not yet approved.
