export const TEAM_SYSTEM_STATES = Object.freeze({
  SECURE_POSSESSION: 'secure-possession',
  CONTESTED_POSSESSION: 'contested-possession',
  OPPONENT_CONTROL: 'opponent-control',
  DEFENSIVE_ZONE: 'defensive-zone',
  SPECIAL_TEAMS: 'special-teams',
  RESTART: 'restart',
});

export const TEAM_SYSTEM_NON_NEGOTIABLES = Object.freeze([
  'Opponent control triggers the coach\'s 1-2-2.',
  'The ball-side winger is the 1 and closes inside-out.',
  'Center and weak-side winger protect the middle as the second layer.',
  'Both defenders stay connected behind the pressure.',
  'F3 remains high and inside whenever possession is uncertain.',
  'A defender steps down only after F3 covers above the ball.',
  'Defensive-zone coverage protects the house before extending outside.',
]);

export const CORE_PLAY_SYSTEM_FITS = Object.freeze({
  trap: Object.freeze({
    states: ['opponent-control'],
    purpose: 'Primary 1-2-2 entry and neutral-zone system.',
  }),
  dzfl: Object.freeze({
    states: ['restart', 'opponent-control', 'secure-possession'],
    purpose: 'Defensive-zone draw response into breakout or house-first coverage.',
  }),
  nfd: Object.freeze({
    states: ['defensive-zone'],
    purpose: 'House-first continuation after the 1-2-2 forces a wide entry.',
  }),
  bck: Object.freeze({
    states: ['secure-possession', 'opponent-control'],
    purpose: 'Turnover recovery that rebuilds the 1-2-2.',
  }),
  pkb: Object.freeze({
    states: ['special-teams'],
    purpose: 'Four-player short-handed unit with the middle protected.',
  }),
  pomr: Object.freeze({
    states: ['secure-possession', 'opponent-control'],
    purpose: 'F3 and weak-side safety rules that prevent counters.',
  }),
  brk: Object.freeze({
    states: ['secure-possession'],
    purpose: 'Connected defensive-zone exit with short support.',
  }),
  zent: Object.freeze({
    states: ['secure-possession', 'contested-possession'],
    purpose: 'Read-first entry with connected support.',
  }),
  ozfl: Object.freeze({
    states: ['restart', 'secure-possession', 'opponent-control'],
    purpose: 'Offensive-zone draw response for either outcome.',
  }),
  'slot-window': Object.freeze({
    states: ['secure-possession'],
    purpose: 'Exploit an abandoned slot without losing the safety layer.',
  }),
  lcl: Object.freeze({
    states: ['secure-possession'],
    purpose: 'Sustained possession that creates a middle opening.',
  }),
  pts: Object.freeze({
    states: ['secure-possession'],
    purpose: 'Point shot with layered net-front and rebound support.',
  }),
  ppum: Object.freeze({
    states: ['special-teams'],
    purpose: 'Five-player power-play movement and seam creation.',
  }),
});

export const CORE_TACTIC_SYSTEM_FITS = Object.freeze({
  'protect-the-middle': Object.freeze({
    states: ['opponent-control'],
    purpose: 'The coach\'s primary 1-2-2 system.',
  }),
  'watch-your-man': Object.freeze({
    states: ['defensive-zone'],
    purpose: 'House-first coverage with clear exchanges.',
  }),
  'gap-control': Object.freeze({
    states: ['opponent-control'],
    purpose: 'Dynamic entry gap that preserves the middle.',
  }),
  'instant-backcheck': Object.freeze({
    states: ['opponent-control'],
    purpose: 'Immediate recovery into the 1-2-2.',
  }),
  'triangle-spacing': Object.freeze({
    states: ['secure-possession'],
    purpose: 'Three-layer offensive support around the ball.',
  }),
  'cycling-the-boards': Object.freeze({
    states: ['secure-possession'],
    purpose: 'Sustained wall possession that opens the slot.',
  }),
});
