const usUniform = {
  jersey: '#f8fafc',
  stripe: '#1d4ed8',
  shorts: '#0f172a',
  helmet: '#f8fafc',
};

const opponentUniform = {
  jersey: '#b91c1c',
  stripe: '#fee2e2',
  shorts: '#111827',
  helmet: '#dc2626',
};

const kf = (time, x, y, facing = 0) => ({ time, position: { x, y }, facing });

export const standardBreakout3dReplay = {
  schemaVersion: 1,
  id: 'standard-breakout-3d',
  kind: 'play',
  title: 'Standard Breakout: Boards Release',
  sourcePlayId: 'brk',
  sourceTacticId: 'breakout-patterns',
  duration: 8.8,
  sourcePhaseTimes: [0, 2.45],
  rink: {
    orientation: 'vertical',
    ourNet: 'bottom',
    theirNet: 'top',
    ourNetY: 6,
    theirNetY: 94,
  },
  presentation: {
    captionsPlacement: 'below-rink',
    coachingOverlaysDefault: false,
    audio: false,
    purpose: 'Beat F1 with a safe boards release, then enter with support.',
    responsibilities: [
      { role: 'Defense', action: 'Draw pressure and bank the ball wide.' },
      { role: 'Winger', action: 'Receive on the wall and carry wide.' },
      { role: 'Center', action: 'Stay underneath as middle support.' },
    ],
  },
  teachingPoints: [
    'LD shoulder-checks, then sends the ball off the left boards around pressure.',
    'The winger times the boards release, receives in stride, and protects the ball up the wall.',
    'The center stays available through the middle while the opposite winger stretches the weak side.',
    'The winger carries across the blue line with middle and weak-side support instead of forcing a cross-court pass.',
    'Both defensemen move after the release so the breakout has support behind it.',
  ],
  cameraPresets: [
    { id: 'broadcast', label: 'Broadcast', position: [0, 22, -28], target: [0, 0, -2.5] },
    { id: 'bench', label: 'Bench', position: [-13, 9, -8], target: [0, 0, 3] },
    { id: 'overhead', label: 'Overhead', position: [0, 26, 0.01], target: [0, 0, 0] },
    { id: 'player', label: 'LD Read', position: [-6, 4.2, -10], target: [-3, 0.8, -6] },
  ],
  players: [
    {
      id: 'US_G', label: 'G', role: 'G', team: 'us', uniform: usUniform,
      keyframes: [kf(0, 50, 7, 0), kf(3, 49, 7.5, -0.2), kf(6, 50.5, 7, 0.15), kf(8.8, 50, 7.2, 0)],
    },
    {
      id: 'US_LD', label: 'LD', role: 'LD', team: 'us', uniform: usUniform,
      keyframes: [kf(0, 35, 4, -0.6), kf(1.6, 27, 8, -0.7), kf(2.8, 22, 15, -0.4), kf(4.5, 25, 24, 0.2), kf(8.8, 36, 40, 0.15)],
    },
    {
      id: 'US_RD', label: 'RD', role: 'RD', team: 'us', uniform: usUniform,
      keyframes: [kf(0, 60, 4, 0.55), kf(2, 58, 12, 0.25), kf(4.2, 51, 18, -0.25), kf(6.8, 49, 31, 0), kf(8.8, 54, 43, 0.15)],
    },
    {
      id: 'US_LW', label: 'LW', role: 'LW', team: 'us', uniform: usUniform,
      keyframes: [kf(0, 8, 35, -0.1), kf(1.7, 8, 42, 0.1), kf(3.9, 11, 46, 0.4), kf(5.7, 14, 55, 0.2), kf(8.8, 22, 70, 0.12)],
    },
    {
      id: 'US_C', label: 'C', role: 'C', team: 'us', uniform: usUniform,
      keyframes: [kf(0, 50, 28, 0), kf(1.8, 43, 31, -0.45), kf(3.8, 38, 36, -0.25), kf(6.2, 45, 48, 0.2), kf(8.8, 49, 66, 0.05)],
    },
    {
      id: 'US_RW', label: 'RW', role: 'RW', team: 'us', uniform: usUniform,
      keyframes: [kf(0, 88, 34, 0.2), kf(2.2, 85, 42, -0.1), kf(4.4, 78, 48, -0.25), kf(6.7, 72, 56, -0.2), kf(8.8, 66, 66, -0.08)],
    },
    {
      id: 'OP_G', label: 'G', role: 'G', team: 'opponent', uniform: opponentUniform,
      keyframes: [kf(0, 50, 93, 3.14), kf(3, 51, 92.4, 3.1), kf(6, 49, 92.7, 3.2), kf(8.8, 50, 93, 3.14)],
    },
    {
      id: 'OP_F1', label: 'C', role: 'C', team: 'opponent', uniform: opponentUniform,
      keyframes: [kf(0, 40, 18, 3), kf(1.7, 32, 20, -1.4), kf(3.1, 25, 22, -1.2), kf(5.2, 17, 34, -0.6), kf(8.8, 24, 48, 0.4)],
    },
    {
      id: 'OP_F2', label: 'RW', role: 'RW', team: 'opponent', uniform: opponentUniform,
      keyframes: [kf(0, 15, 30, 0.1), kf(1.9, 12, 34, 0.2), kf(3.4, 10, 40, 0.4), kf(6, 15, 50, 0.2), kf(8.8, 24, 60, 0.1)],
    },
    {
      id: 'OP_F3', label: 'LW', role: 'LW', team: 'opponent', uniform: opponentUniform,
      keyframes: [kf(0, 75, 30, -0.1), kf(1.9, 70, 36, -0.2), kf(3.5, 64, 39, -0.35), kf(6, 59, 49, -0.1), kf(8.8, 58, 58, 0.15)],
    },
    {
      id: 'OP_D1', label: 'RD', role: 'RD', team: 'opponent', uniform: opponentUniform,
      keyframes: [kf(0, 30, 48, 3.1), kf(2.2, 30, 52, 3.05), kf(4.5, 28, 56, 2.8), kf(6.4, 30, 61, 2.7), kf(8.8, 34, 68, 2.8)],
    },
    {
      id: 'OP_D2', label: 'LD', role: 'LD', team: 'opponent', uniform: opponentUniform,
      keyframes: [kf(0, 65, 48, 3.15), kf(2.2, 62, 52, 3), kf(4.5, 60, 55, 2.9), kf(6.4, 59, 60, 2.8), kf(8.8, 61, 67, 2.8)],
    },
  ],
  ball: {
    radius: 0.13,
    segments: [
      {
        type: 'carry',
        from: 0,
        to: 2.4,
        ownerId: 'US_LD',
        start: { x: 35, y: 4 },
        end: { x: 22, y: 15 },
      },
      {
        type: 'board-pass',
        from: 2.4,
        to: 4.6,
        fromPlayerId: 'US_LD',
        toPlayerId: 'US_LW',
        incoming: { x: 22, y: 15 },
        impact: { x: 4, y: 32 },
        exitTarget: { x: 12, y: 45 },
        restitution: 0.68,
      },
      {
        type: 'carry',
        from: 4.6,
        to: 8.8,
        ownerId: 'US_LW',
        start: { x: 12, y: 45 },
        end: { x: 22, y: 70 },
      },
    ],
  },
  events: [
    {
      time: 0.4,
      label: 'LD retrieves behind our net',
      nextRead: 'Draw F1; release off the left boards',
    },
    {
      time: 2.45,
      label: 'Board pass: LD uses the left boards to beat F1',
      nextRead: 'Winger times the boards receive',
    },
    {
      time: 4.6,
      label: 'Winger receives in stride and protects the ball',
      nextRead: 'Protect the wall; C fills underneath',
    },
    {
      time: 5.8,
      label: 'Winger carries up the wall with middle support',
      nextRead: 'Gain the line before moving inside',
    },
    {
      time: 7.6,
      label: 'Winger gains the blue line under control',
      nextRead: 'Protect wide; scan C underneath',
    },
    {
      time: 8.35,
      label: 'Winger delays wide and establishes possession',
      nextRead: 'Hold the wall; let both support lanes arrive',
    },
  ],
};
