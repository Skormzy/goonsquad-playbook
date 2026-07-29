import { PRIMARY_DEFENSIVE_PLAY } from './strategyFirstPlays.js';

const opponent = (id, x, y, label, hasBall = false) => ({
  id,
  x,
  y,
  label,
  ...(hasBall ? { hasBall: true } : {}),
});

const opponentGoalie = (x = 50, y = 93) => ({
  id: 'og',
  x,
  y,
  label: 'G',
  isGoalie: true,
});

const PRIMARY_DEFENSIVE_TACTIC_PHASES = Object.freeze(
  PRIMARY_DEFENSIVE_PLAY.phases.map((phase) => Object.freeze({
    duration: phase.duration,
    caption: phase.desc,
    our: phase.pos,
    opp: phase.opp.map((player) => ({
      ...player,
      label: player.l,
      isGoalie: player.l === 'G',
    })),
    ball: phase.ball,
    ballPath: phase.ballPath ?? null,
    coverage: phase.coverage ?? null,
    arrows: [],
  })),
);

export const STRONG_SIDE_LOCK_TACTIC = Object.freeze({
  id: 'protect-the-middle',
  category: 'Defense',
  title: '1-2-2 Strong-Side Lock',
  subtitle: 'Our primary defensive system after they gain possession',
  principle: 'The winger on the ball side becomes the 1 and closes inside-out. The center and weak-side winger protect the middle as the second layer. Both defenders stay connected behind them. Every pass across the rink triggers a five-player shift and a new strong-side 1.',
  why: 'One player can pressure the ball, but only the full five-player shift closes the rink. The system slows the attack, removes the middle, and makes the opponent advance along the boards into support instead of entering with speed.',
  keyPoints: [
    'Call the ball side immediately so the correct winger becomes the 1',
    'The 1 takes an inside-out route and never gives away the middle',
    'Center and weak-side winger move underneath as the second layer',
    'Both defenders slide together and stay inside the dangerous lanes',
    'On a reversal, hand off pressure immediately and shift all five players',
  ],
  mistakeScene: {
    coverage: { RW: 'o5', C: 'o1', LW: 'o4', RD: 'o3', LD: 'o2' },
    phases: [
      PRIMARY_DEFENSIVE_TACTIC_PHASES[0],
      {
        duration: 3.25,
        caption: 'RW chases from the outside while C drifts to the wall. The middle opens.',
        our: {
          G: { x: 51, y: 8 },
          LW: { x: 35, y: 46 },
          C: { x: 67, y: 47 },
          RW: { x: 79, y: 53 },
          LD: { x: 38, y: 35 },
          RD: { x: 69, y: 34 },
        },
        opp: [
          opponent('o1', 51, 48, 'C'),
          opponent('o2', 28, 53, 'RW'),
          opponent('o3', 80, 49, 'LW'),
          opponent('o4', 36, 58, 'RD'),
          opponent('o5', 77, 55, 'LD', true),
          opponentGoalie(51),
        ],
        ball: { x: 77, y: 55 },
        arrows: [],
      },
      {
        duration: 3.25,
        caption: 'Their center receives through the open middle with speed.',
        our: {
          G: { x: 50, y: 8 },
          LW: { x: 39, y: 43 },
          C: { x: 63, y: 41 },
          RW: { x: 76, y: 45 },
          LD: { x: 42, y: 31 },
          RD: { x: 65, y: 30 },
        },
        opp: [
          opponent('o1', 50, 39, 'C', true),
          opponent('o2', 27, 47, 'RW'),
          opponent('o3', 76, 44, 'LW'),
          opponent('o4', 36, 54, 'RD'),
          opponent('o5', 72, 50, 'LD'),
          opponentGoalie(49),
        ],
        ball: { x: 50, y: 39 },
        arrows: [
          { from: { x: 77, y: 55 }, to: { x: 50, y: 39 }, type: 'pass' },
        ],
      },
      {
        duration: 3.5,
        caption: 'The broken shape gives up a clean slot chance.',
        our: {
          G: { x: 49, y: 8 },
          LW: { x: 42, y: 36 },
          C: { x: 57, y: 31 },
          RW: { x: 70, y: 36 },
          LD: { x: 43, y: 22 },
          RD: { x: 61, y: 22 },
        },
        opp: [
          opponent('o1', 50, 20, 'C'),
          opponent('o2', 28, 35, 'RW'),
          opponent('o3', 72, 34, 'LW'),
          opponent('o4', 35, 49, 'RD'),
          opponent('o5', 68, 46, 'LD'),
          opponentGoalie(50),
        ],
        ball: { x: 50, y: 8 },
        arrows: [
          { from: { x: 50, y: 20 }, to: { x: 50, y: 8 }, type: 'shot' },
        ],
      },
    ],
  },
  correctScene: {
    coverage: { RW: 'o5', C: 'o1', LW: 'o4', RD: 'o3', LD: 'o2' },
    phases: PRIMARY_DEFENSIVE_TACTIC_PHASES,
  },
  linkedPlays: ['trap', 'nfd', 'bck'],
});

export const STRATEGY_FIRST_TACTIC_OVERRIDES = Object.freeze({
  'protect-the-middle': STRONG_SIDE_LOCK_TACTIC,
});
