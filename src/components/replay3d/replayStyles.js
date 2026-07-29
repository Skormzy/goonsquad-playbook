export const REPLAY_COLORS = {
  floor: '#a8bbb3',
  floorDark: '#5f766d',
  boardWhite: '#f8fafc',
  boardKick: '#facc15',
  boardCap: '#1e293b',
  glass: '#dbeafe',
  lineBlue: '#2563eb',
  lineRed: '#dc2626',
  crease: '#93c5fd',
  ball: '#f97316',
  stick: '#1f2937',
  shadow: '#020617',
};

export const TEAM_COLORS = {
  us: '#2563eb',
  opponent: '#dc2626',
};

export const CAMERA_PRESETS = {
  broadcast: {
    label: 'Broadcast',
    position: [-8.9, 29.0, -55.2],
    target: [-1.0, 1.25, -10.4],
    fov: 34.8,
    followBall: true,
    followPosition: { x: 0.026, z: 0.06 },
    followTarget: { x: 0.052, z: 0.09 },
  },
  bench: { label: 'Bench', position: [-14, 14, -50], target: [0, 1, -2], fov: 32 },
  overhead: { label: 'Overhead', position: [0, 49, 0.01], target: [0, 0, 0], fov: 42 },
  player: {
    label: 'LD Read',
    position: [-5.7, 10.9, -41.5],
    target: [-3.6, 2.3, -18.8],
    fov: 29.92,
    mobileFovBoost: 3,
  },
};
