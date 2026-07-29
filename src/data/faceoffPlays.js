const HOME_GOALIE = {
  x: 50,
  y: 8,
  role: 'Set in the crease and track the draw through traffic.',
  u: 'hold',
};

const OPPONENT_GOALIE = {
  id: 'op-g',
  x: 50,
  y: 92,
  l: 'G',
};

export const FACE_OFF_OUTCOMES = Object.freeze(['won', 'lost']);

export function normalizeFaceoffOutcome(value) {
  return value === 'lost' ? 'lost' : 'won';
}

const homePlayer = (x, y, role, u = 'hold', extra = {}) => ({
  x,
  y,
  role,
  u,
  ...extra,
});

const opponentPlayer = (id, role, x, y, extra = {}) => ({
  id,
  x,
  y,
  l: role,
  ...extra,
});

function openingPhases({ dot, home, opponents, targetLabel }) {
  const setHome = {
    ...home,
    C: {
      ...home.C,
      y: dot.y - 1.65,
    },
  };
  const setOpponents = opponents.map((player) => (
    player.l === 'C'
      ? { ...player, y: dot.y + 1.65 }
      : player
  ));
  const drawHome = {
    ...setHome,
    C: {
      ...setHome.C,
      role: `Ball is down. Sweep through it toward ${targetLabel}; do not leave early.`,
      u: 'run',
    },
  };

  return [
    {
      id: 0,
      t: 'Set for the Draw',
      desc: 'Centers square up. Every other runner stays on-side and outside the circle.',
      duration: 1.15,
      faceoffState: 'set',
      ballOwner: null,
      pos: setHome,
      opp: setOpponents,
      ball: dot,
      lanes: [],
    },
    {
      id: 1,
      t: 'Ball Down',
      desc: `Wait for the ball to reach the floor, then pull it cleanly toward ${targetLabel}.`,
      duration: 0.62,
      faceoffState: 'draw',
      ballOwner: null,
      pos: drawHome,
      opp: setOpponents,
      ball: dot,
      lanes: [],
    },
  ];
}

function defineFaceoffPlay({
  id,
  name,
  category,
  description,
  strategy,
  zone,
  dot,
  drawTarget,
  lostDrawTarget,
  losingResponse,
  home,
  opponents,
  resolutionPhases,
  lostResolutionPhases,
}) {
  const targetLabel = drawTarget.replace('US_', '');
  const opening = openingPhases({ dot, home, opponents, targetLabel });
  const phasesFor = (phases) => [
    ...opening,
    ...phases.map((phase, index) => ({
      ...phase,
      id: index + 2,
    })),
  ];
  const wonPhases = phasesFor(resolutionPhases);
  const lostPhases = phasesFor(lostResolutionPhases);
  const lostDescription = `Respond to a lost draw with connected pressure and protect the dangerous middle first. ${losingResponse}`;

  return {
    id,
    n: name,
    cat: category,
    d: 'basic',
    desc: description,
    strat: strategy,
    faceoff: {
      dot,
      zone,
      attackingDirection: 'high-y',
      defaultOutcome: 'won',
      outcome: 'won',
      drawTarget,
      outcomeTarget: drawTarget,
      lostDrawTarget,
      losingResponse,
    },
    faceoffVariants: {
      won: {
        description,
        strategy,
        target: drawTarget,
        phases: wonPhases,
      },
      lost: {
        description: lostDescription,
        strategy: losingResponse,
        target: lostDrawTarget,
        phases: lostPhases,
      },
    },
    phases: wonPhases,
  };
}

export function resolveFaceoffPlayOutcome(play, requestedOutcome = 'won') {
  if (!play?.faceoff || !play.faceoffVariants) return play;
  const outcome = normalizeFaceoffOutcome(requestedOutcome);
  if (play.faceoff.outcome === outcome) return play;
  const variant = play.faceoffVariants[outcome];
  return {
    ...play,
    desc: variant.description,
    strat: variant.strategy,
    faceoff: {
      ...play.faceoff,
      outcome,
      outcomeTarget: variant.target,
    },
    phases: variant.phases,
  };
}

function defensiveZoneLostPhases({ right = false } = {}) {
  const x = (value) => (right ? 100 - value : value);
  const strongWinger = right ? 'RW' : 'LW';
  const strongDefense = right ? 'RD' : 'LD';
  const strongPointId = right ? 'op-rd' : 'op-ld';
  const strongPointRole = right ? 'RD' : 'LD';
  const weakPointId = right ? 'op-ld' : 'op-rd';
  const weakPointRole = right ? 'LD' : 'RD';
  const wallOpponentId = right ? 'op-lw' : 'op-rw';
  const wallOpponentRole = right ? 'LW' : 'RW';
  const weakWingerId = right ? 'op-rw' : 'op-lw';
  const weakWingerRole = right ? 'RW' : 'LW';

  const homeWinger = (role, strong, weak) => (role === strongWinger ? strong : weak);
  const homeDefense = (role, strong, weak) => (role === strongDefense ? strong : weak);

  return [
    {
      t: 'Draw Lost - Protect Inside',
      desc: 'The draw reaches their strong-side point. We stay inside the ball before applying pressure.',
      duration: 1.55,
      faceoffState: 'secured',
      ballOwner: strongPointId,
      pos: {
        LW: homeWinger('LW',
          homePlayer(x(12), 29, 'Close the strong-side point from the middle out.', 'sprint'),
          homePlayer(x(48), 28, 'Stay between the weak-side point and the slot.', 'run')),
        C: homePlayer(x(31), 24, 'Finish the tie-up, then recover underneath the ball.', 'run'),
        RW: homeWinger('RW',
          homePlayer(x(12), 29, 'Close the strong-side point from the middle out.', 'sprint'),
          homePlayer(x(48), 28, 'Stay between the weak-side point and the slot.', 'run')),
        LD: homeDefense('LD',
          homePlayer(x(22), 14, 'Protect the strong post and keep the wall runner outside.', 'run'),
          homePlayer(x(49), 15, 'Own the low slot and track the inside runner.', 'run')),
        RD: homeDefense('RD',
          homePlayer(x(22), 14, 'Protect the strong post and keep the wall runner outside.', 'run'),
          homePlayer(x(49), 15, 'Own the low slot and track the inside runner.', 'run')),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', x(31), 25),
        opponentPlayer(wallOpponentId, wallOpponentRole, x(11), 27),
        opponentPlayer(weakWingerId, weakWingerRole, x(45), 28),
        opponentPlayer(strongPointId, strongPointRole, x(26), 27, { ball: true }),
        opponentPlayer(weakPointId, weakPointRole, x(56), 34),
        OPPONENT_GOALIE,
      ],
      ball: { x: x(26), y: 27 },
      ballPath: [
        { x: x(28), y: 21 },
        { x: x(28), y: 23 },
        { x: x(27), y: 25 },
        { x: x(26), y: 27 },
      ],
      lanes: [],
    },
    {
      t: 'Pressure From Inside Out',
      desc: 'The nearest winger takes away the point shot and forces the ball down the wall.',
      duration: 1.9,
      faceoffState: 'execute',
      ballOwner: wallOpponentId,
      pos: {
        LW: homeWinger('LW',
          homePlayer(x(14), 35, 'Angle the carrier toward the boards without opening the middle.', 'sprint'),
          homePlayer(x(51), 31, 'Hold the weak-side seam and stay above the slot.', 'run')),
        C: homePlayer(x(34), 27, 'Protect the middle lane and support the wall pressure.', 'run'),
        RW: homeWinger('RW',
          homePlayer(x(14), 35, 'Angle the carrier toward the boards without opening the middle.', 'sprint'),
          homePlayer(x(51), 31, 'Hold the weak-side seam and stay above the slot.', 'run')),
        LD: homeDefense('LD',
          homePlayer(x(18), 18, 'Stay inside the wall runner and deny the cut to the net.', 'run'),
          homePlayer(x(48), 17, 'Protect the low slot and communicate the switch.', 'run')),
        RD: homeDefense('RD',
          homePlayer(x(18), 18, 'Stay inside the wall runner and deny the cut to the net.', 'run'),
          homePlayer(x(48), 17, 'Protect the low slot and communicate the switch.', 'run')),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', x(34), 26),
        opponentPlayer(wallOpponentId, wallOpponentRole, x(9), 36, { ball: true }),
        opponentPlayer(weakWingerId, weakWingerRole, x(47), 29),
        opponentPlayer(strongPointId, strongPointRole, x(27), 39),
        opponentPlayer(weakPointId, weakPointRole, x(59), 38),
        OPPONENT_GOALIE,
      ],
      ball: { x: x(9), y: 36 },
      ballPath: [
        { x: x(26), y: 27 },
        { x: x(20), y: 30 },
        { x: x(14), y: 33 },
        { x: x(9), y: 36 },
      ],
      lanes: [],
    },
    {
      t: 'Contain the Outside',
      desc: 'All five defenders stay connected. The ball remains outside while the slot and back door are protected.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: wallOpponentId,
      pos: {
        LW: homeWinger('LW',
          homePlayer(x(11), 31, 'Stay above the carrier and remove the pass back to the point.', 'run'),
          homePlayer(x(52), 29, 'Keep the weak-side point in front of you.', 'run')),
        C: homePlayer(x(33), 24, 'Stay in the middle and close any pass into the slot.', 'run'),
        RW: homeWinger('RW',
          homePlayer(x(11), 31, 'Stay above the carrier and remove the pass back to the point.', 'run'),
          homePlayer(x(52), 29, 'Keep the weak-side point in front of you.', 'run')),
        LD: homeDefense('LD',
          homePlayer(x(16), 17, 'Seal the strong post and keep body position inside.', 'run'),
          homePlayer(x(46), 16, 'Track the back door and protect the crease.', 'run')),
        RD: homeDefense('RD',
          homePlayer(x(16), 17, 'Seal the strong post and keep body position inside.', 'run'),
          homePlayer(x(46), 16, 'Track the back door and protect the crease.', 'run')),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', x(32), 22),
        opponentPlayer(wallOpponentId, wallOpponentRole, x(10), 30, { ball: true }),
        opponentPlayer(weakWingerId, weakWingerRole, x(48), 24),
        opponentPlayer(strongPointId, strongPointRole, x(28), 37),
        opponentPlayer(weakPointId, weakPointRole, x(60), 36),
        OPPONENT_GOALIE,
      ],
      ball: { x: x(10), y: 30 },
      lanes: [],
    },
  ];
}

function neutralZoneLostPhases() {
  return [
    {
      t: 'Draw Lost - Recover Inside',
      desc: 'Their LD secures the draw. All three forwards recover between the ball and our net.',
      duration: 1.45,
      faceoffState: 'secured',
      ballOwner: 'op-ld',
      pos: {
        LW: homePlayer(27, 45, 'Recover inside their right winger and take away the wide lane.', 'sprint'),
        C: homePlayer(50, 44, 'Release from the tie-up and own the middle lane.', 'sprint'),
        RW: homePlayer(73, 45, 'Recover inside their left winger and take away the wide lane.', 'sprint'),
        LD: homePlayer(35, 36, 'Hold a tight gap beneath the left lane.', 'run'),
        RD: homePlayer(65, 36, 'Hold a tight gap beneath the right lane.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 50, 48),
        opponentPlayer('op-rw', 'RW', 27, 48),
        opponentPlayer('op-lw', 'LW', 73, 48),
        opponentPlayer('op-ld', 'LD', 44, 54, { ball: true }),
        opponentPlayer('op-rd', 'RD', 64, 57),
        OPPONENT_GOALIE,
      ],
      ball: { x: 44, y: 54 },
      ballPath: [{ x: 50, y: 50 }, { x: 48, y: 51 }, { x: 46, y: 53 }, { x: 44, y: 54 }],
      lanes: [],
    },
    {
      t: 'Take Away the Quick-Up',
      desc: 'Their LD moves it wide. Our winger stays inside the receiver while C protects the middle.',
      duration: 2,
      faceoffState: 'execute',
      ballOwner: 'op-rw',
      pos: {
        LW: homePlayer(23, 39, 'Stay on the inside shoulder and steer the carrier toward the boards.', 'sprint'),
        C: homePlayer(48, 38, 'Track through the middle and remove the return pass.', 'sprint'),
        RW: homePlayer(70, 41, 'Stay connected to the weak-side winger.', 'sprint'),
        LD: homePlayer(32, 30, 'Match the carrier with a controlled gap.', 'run'),
        RD: homePlayer(62, 30, 'Protect the middle and read the weak-side lane.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 50, 42),
        opponentPlayer('op-rw', 'RW', 18, 41, { ball: true }),
        opponentPlayer('op-lw', 'LW', 75, 43),
        opponentPlayer('op-ld', 'LD', 38, 49),
        opponentPlayer('op-rd', 'RD', 65, 50),
        OPPONENT_GOALIE,
      ],
      ball: { x: 18, y: 41 },
      ballPath: [{ x: 44, y: 54 }, { x: 35, y: 50 }, { x: 26, y: 45 }, { x: 18, y: 41 }],
      lanes: [],
    },
    {
      t: 'Defend the Entry',
      desc: 'The carrier reaches our blue line outside the dots with all five defenders connected underneath.',
      duration: 2.1,
      faceoffState: 'complete',
      ballOwner: 'op-rw',
      pos: {
        LW: homePlayer(22, 34, 'Stay above and inside the carrier.', 'sprint'),
        C: homePlayer(47, 33, 'Protect the middle and support either side.', 'sprint'),
        RW: homePlayer(69, 36, 'Track the weak-side runner through the line.', 'sprint'),
        LD: homePlayer(29, 24, 'Hold the outside lane and deny a direct path to the slot.', 'run'),
        RD: homePlayer(60, 25, 'Stay inside and protect the middle lane.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 48, 35),
        opponentPlayer('op-rw', 'RW', 16, 32, { ball: true }),
        opponentPlayer('op-lw', 'LW', 76, 37),
        opponentPlayer('op-ld', 'LD', 37, 43),
        opponentPlayer('op-rd', 'RD', 66, 44),
        OPPONENT_GOALIE,
      ],
      ball: { x: 16, y: 32 },
      lanes: [],
    },
  ];
}

function offensiveZoneLostPhases() {
  return [
    {
      t: 'Draw Lost - Pressure the Outlet',
      desc: 'Their LD secures the draw. The nearest winger pressures while the other four players stay above the ball.',
      duration: 1.55,
      faceoffState: 'secured',
      ballOwner: 'op-ld',
      pos: {
        LW: homePlayer(14, 85, 'Pressure the receiver from the middle out and deny the easy wall pass.', 'sprint'),
        C: homePlayer(31, 83, 'Stay over the middle and prevent a clean center outlet.', 'run'),
        RW: homePlayer(49, 82, 'Hold the weak side and stay above their winger.', 'run'),
        LD: homePlayer(23, 72, 'Hold the strong-side line with a safe gap.', 'run'),
        RD: homePlayer(60, 71, 'Stay connected across the line and protect the middle.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 82),
        opponentPlayer('op-rw', 'RW', 9, 84),
        opponentPlayer('op-lw', 'LW', 49, 84),
        opponentPlayer('op-ld', 'LD', 23, 85, { ball: true }),
        opponentPlayer('op-rd', 'RD', 59, 88),
        OPPONENT_GOALIE,
      ],
      ball: { x: 23, y: 85 },
      ballPath: [{ x: 28, y: 79 }, { x: 27, y: 81 }, { x: 25, y: 83 }, { x: 23, y: 85 }],
      lanes: [],
    },
    {
      t: 'Stay Above the Ball',
      desc: 'The outlet is forced down the boards. We keep three players above it and prepare to regain possession.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: 'op-rw',
      pos: {
        LW: homePlayer(10, 76, 'Stay goal side and pressure the wall carrier without overcommitting.', 'sprint'),
        C: homePlayer(31, 77, 'Seal the middle and support the pressure.', 'sprint'),
        RW: homePlayer(55, 79, 'Stay above the weak-side option.', 'run'),
        LD: homePlayer(20, 68, 'Hold the line only while the pressure remains connected.', 'run'),
        RD: homePlayer(58, 67, 'Balance the line and be ready to recover.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 34, 78),
        opponentPlayer('op-rw', 'RW', 7, 74, { ball: true }),
        opponentPlayer('op-lw', 'LW', 54, 80),
        opponentPlayer('op-ld', 'LD', 18, 84),
        opponentPlayer('op-rd', 'RD', 58, 85),
        OPPONENT_GOALIE,
      ],
      ball: { x: 7, y: 74 },
      ballPath: [{ x: 23, y: 85 }, { x: 16, y: 82 }, { x: 10, y: 78 }, { x: 7, y: 74 }],
      lanes: [],
    },
  ];
}

function powerPlayLostPhases() {
  return [
    {
      t: 'Draw Lost - Pressure the Clear',
      desc: 'Their LD wins possession. LW closes immediately while both point players hold their structure.',
      duration: 1.5,
      faceoffState: 'secured',
      ballOwner: 'op-ld',
      pos: {
        LW: homePlayer(14, 85, 'Close from inside out and take away a clean clearing lane.', 'sprint'),
        C: homePlayer(32, 84, 'Stay between the carrier and the middle outlet.', 'run'),
        RW: homePlayer(50, 84, 'Hold the weak-side seam and be ready for a loose clear.', 'run'),
        LD: homePlayer(23, 71, 'Hold the strong point without drifting below the ball.', 'run'),
        RD: homePlayer(60, 70, 'Stay connected across the line as the safety.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 82),
        opponentPlayer('op-lw', 'LW', 47, 84),
        opponentPlayer('op-ld', 'LD', 23, 85, { ball: true }),
        opponentPlayer('op-rd', 'RD', 59, 88),
        opponentPlayer('op-rw', 'RW', 98, 50, { inactive: true, status: 'penalty-box' }),
        OPPONENT_GOALIE,
      ],
      ball: { x: 23, y: 85 },
      ballPath: [{ x: 28, y: 79 }, { x: 27, y: 81 }, { x: 25, y: 83 }, { x: 23, y: 85 }],
      lanes: [],
    },
    {
      t: 'Regroup After the Clear',
      desc: 'The pressured clear leaves the zone. Both defense players turn together and the three forwards reload above the ball.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: null,
      pos: {
        LW: homePlayer(17, 68, 'Reload through the strong lane and support the recovery.', 'sprint'),
        C: homePlayer(40, 66, 'Come underneath as the first regroup option.', 'sprint'),
        RW: homePlayer(67, 68, 'Hold width as the weak-side regroup option.', 'sprint'),
        LD: homePlayer(27, 61, 'Turn early and recover the clear with the floor in front of you.', 'sprint'),
        RD: homePlayer(59, 60, 'Stay level with LD and protect against a short-handed rush.', 'sprint'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 35, 73),
        opponentPlayer('op-lw', 'LW', 53, 74),
        opponentPlayer('op-ld', 'LD', 20, 80),
        opponentPlayer('op-rd', 'RD', 58, 81),
        opponentPlayer('op-rw', 'RW', 98, 50, { inactive: true, status: 'penalty-box' }),
        OPPONENT_GOALIE,
      ],
      ball: { x: 8, y: 60 },
      ballPath: [{ x: 23, y: 85 }, { x: 17, y: 77 }, { x: 12, y: 68 }, { x: 8, y: 60 }],
      lanes: [],
    },
  ];
}

function penaltyKillLostPhases() {
  const inactiveHomeWinger = homePlayer(
    98,
    50,
    'Serving the penalty and off the playing surface.',
    'hold',
    { inactive: true, status: 'penalty-box' },
  );
  return [
    {
      t: 'Draw Lost - Build the Box',
      desc: 'Their LD secures the draw. The four active defenders collapse inside the dots immediately.',
      duration: 1.45,
      faceoffState: 'secured',
      ballOwner: 'op-ld',
      pos: {
        LW: homePlayer(20, 28, 'Close the strong point from inside the shooting lane.', 'sprint'),
        C: homePlayer(39, 28, 'Take the other high corner and protect the middle seam.', 'sprint'),
        RW: inactiveHomeWinger,
        LD: homePlayer(23, 16, 'Own the strong low corner and protect the post.', 'run'),
        RD: homePlayer(45, 16, 'Own the weak low corner and protect the back door.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 32, 25),
        opponentPlayer('op-rw', 'RW', 10, 28),
        opponentPlayer('op-lw', 'LW', 48, 27),
        opponentPlayer('op-ld', 'LD', 26, 27, { ball: true }),
        opponentPlayer('op-rd', 'RD', 56, 35),
        OPPONENT_GOALIE,
      ],
      ball: { x: 26, y: 27 },
      ballPath: [{ x: 28, y: 21 }, { x: 28, y: 23 }, { x: 27, y: 25 }, { x: 26, y: 27 }],
      lanes: [],
    },
    {
      t: 'Shift as One Unit',
      desc: 'The point moves it to the flank. The box shifts together without opening the slot seam.',
      duration: 1.7,
      faceoffState: 'execute',
      ballOwner: 'op-rw',
      pos: {
        LW: homePlayer(14, 26, 'Pressure the flank with the stick in the passing lane.', 'sprint'),
        C: homePlayer(37, 27, 'Slide across the top and keep the middle seam closed.', 'run'),
        RW: inactiveHomeWinger,
        LD: homePlayer(20, 15, 'Stay inside the carrier and protect the strong post.', 'run'),
        RD: homePlayer(43, 16, 'Shift across the crease and hold the back door.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 33, 23),
        opponentPlayer('op-rw', 'RW', 8, 29, { ball: true }),
        opponentPlayer('op-lw', 'LW', 49, 25),
        opponentPlayer('op-ld', 'LD', 27, 37),
        opponentPlayer('op-rd', 'RD', 57, 36),
        OPPONENT_GOALIE,
      ],
      ball: { x: 8, y: 29 },
      ballPath: [{ x: 26, y: 27 }, { x: 20, y: 28 }, { x: 14, y: 29 }, { x: 8, y: 29 }],
      lanes: [],
    },
    {
      t: 'Keep the Ball Outside',
      desc: 'The compact box denies the slot and forces the power play to stay on the perimeter.',
      duration: 2.1,
      faceoffState: 'complete',
      ballOwner: 'op-rw',
      pos: {
        LW: homePlayer(12, 24, 'Stay above the carrier and deny the pass back through the middle.', 'run'),
        C: homePlayer(35, 25, 'Hold the top seam and be ready to recover to the point.', 'run'),
        RW: inactiveHomeWinger,
        LD: homePlayer(18, 14, 'Protect the near post and keep the carrier outside.', 'run'),
        RD: homePlayer(41, 15, 'Protect the crease and track the weak-side runner.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 22),
        opponentPlayer('op-rw', 'RW', 7, 25, { ball: true }),
        opponentPlayer('op-lw', 'LW', 48, 23),
        opponentPlayer('op-ld', 'LD', 28, 35),
        opponentPlayer('op-rd', 'RD', 57, 34),
        OPPONENT_GOALIE,
      ],
      ball: { x: 7, y: 25 },
      lanes: [],
    },
  ];
}

const dZoneLeft = defineFaceoffPlay({
  id: 'dzfl',
  name: 'D-Zone Faceoff - Left',
  category: 'defensive',
  description: 'Win the draw cleanly, establish control, and exit up the strong-side wall.',
  strategy: 'C pulls the ball to LD. LW opens immediately on the wall, C gets underneath the outlet, and RW stays available through the middle. If the draw is lost, protect the slot first and match the two point threats.',
  zone: 'defensive-left',
  dot: { x: 28, y: 21 },
  drawTarget: 'US_LD',
  lostDrawTarget: 'OP_LD',
  losingResponse: 'Protect the slot first; wingers close the points while both defense players stay inside.',
  lostResolutionPhases: defensiveZoneLostPhases(),
  home: {
    LW: homePlayer(8, 19.2, 'Outside the circle on the boards side. Release to the wall only after the drop.'),
    C: homePlayer(28, 18.4, 'Square to their center with the stick set. Pull the draw behind you to LD.'),
    RW: homePlayer(48, 19.2, 'Outside the circle on the slot side. Seal their winger after the drop.'),
    LD: homePlayer(16, 11.5, 'Strong-side draw target. Stay behind C and present a clean receiving lane.'),
    RD: homePlayer(49, 14.5, 'Weak-side support. Protect the middle and be ready for a reverse.'),
    G: HOME_GOALIE,
  },
  opponents: [
    opponentPlayer('op-c', 'C', 28, 23.6),
    opponentPlayer('op-rw', 'RW', 8, 22.8),
    opponentPlayer('op-lw', 'LW', 48, 22.8),
    opponentPlayer('op-ld', 'LD', 24, 33),
    opponentPlayer('op-rd', 'RD', 55, 33),
    OPPONENT_GOALIE,
  ],
  resolutionPhases: [
    {
      t: 'Draw Won to LD',
      desc: 'C pulls it behind the pressure. LD receives with the body open to the wall.',
      duration: 1.55,
      faceoffState: 'secured',
      ballOwner: 'US_LD',
      pos: {
        LW: homePlayer(9, 29, 'Open on the left wall and show a clear target.', 'sprint', { comm: 'WALL!' }),
        C: homePlayer(29, 21, 'Finish the tie-up, then release underneath the wall option.', 'run'),
        RW: homePlayer(49, 29, 'Stay inside as the middle outlet and defensive safety.', 'run'),
        LD: homePlayer(19, 13, 'Secure the draw, get the head up, and hit the first clean option.', 'hold', { ball: true }),
        RD: homePlayer(55, 10, 'Slide behind the net as the reverse option.', 'run', { comm: 'REVERSE!' }),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 30, 24),
        opponentPlayer('op-rw', 'RW', 13, 25),
        opponentPlayer('op-lw', 'LW', 42, 26),
        opponentPlayer('op-ld', 'LD', 25, 36),
        opponentPlayer('op-rd', 'RD', 55, 36),
        OPPONENT_GOALIE,
      ],
      ball: { x: 19, y: 13 },
      ballPath: [{ x: 28, y: 21 }, { x: 25, y: 19 }, { x: 22, y: 16 }, { x: 19, y: 13 }],
      lanes: [{ f: 'LD', t: 'LW', ty: 'primary' }, { f: 'LD', t: 'C', ty: 'secondary' }],
    },
    {
      t: 'Strong-Side Outlet',
      desc: 'LD moves it up the wall to LW while the middle lane stays supported.',
      duration: 1.9,
      faceoffState: 'execute',
      ballOwner: 'US_LW',
      pos: {
        LW: homePlayer(8, 40, 'Receive on the move and carry beyond the blue line.', 'sprint', { ball: true }),
        C: homePlayer(36, 34, 'Stay below the ball as the short middle option.', 'sprint'),
        RW: homePlayer(68, 40, 'Hold width on the far side and keep their defense spread.', 'sprint'),
        LD: homePlayer(21, 22, 'Follow the pass and close the space behind LW.', 'run'),
        RD: homePlayer(52, 18, 'Advance through the middle as the back-side safety.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 31),
        opponentPlayer('op-rw', 'RW', 14, 34),
        opponentPlayer('op-lw', 'LW', 55, 34),
        opponentPlayer('op-ld', 'LD', 34, 48),
        opponentPlayer('op-rd', 'RD', 64, 49),
        OPPONENT_GOALIE,
      ],
      ball: { x: 8, y: 40 },
      ballPath: [{ x: 19, y: 13 }, { x: 11, y: 22 }, { x: 8, y: 31 }, { x: 8, y: 40 }],
      lanes: [{ f: 'LW', t: 'C', ty: 'primary' }],
    },
    {
      t: 'Controlled Zone Exit',
      desc: 'LW exits with support underneath and width across the floor.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: 'US_LW',
      pos: {
        LW: homePlayer(10, 50, 'Carry through the neutral zone with the ball protected.', 'sprint', { ball: true }),
        C: homePlayer(39, 44, 'Stay connected underneath the carrier.', 'sprint'),
        RW: homePlayer(76, 49, 'Stretch the far side and remain a passing option.', 'sprint'),
        LD: homePlayer(24, 31, 'Move up behind the play to hold the gap.', 'run'),
        RD: homePlayer(57, 28, 'Stay balanced behind the attack.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 34, 38),
        opponentPlayer('op-rw', 'RW', 18, 42),
        opponentPlayer('op-lw', 'LW', 58, 41),
        opponentPlayer('op-ld', 'LD', 35, 56),
        opponentPlayer('op-rd', 'RD', 66, 57),
        OPPONENT_GOALIE,
      ],
      ball: { x: 10, y: 50 },
      lanes: [{ f: 'LW', t: 'C', ty: 'secondary' }, { f: 'LW', t: 'RW', ty: 'outlet' }],
    },
  ],
});

const dZoneRight = defineFaceoffPlay({
  id: 'dzfr',
  name: 'D-Zone Faceoff - Right',
  category: 'defensive',
  description: 'Win the draw cleanly, establish control, and exit up the strong-side wall.',
  strategy: 'C pulls the ball to RD. RW opens immediately on the wall, C gets underneath the outlet, and LW stays available through the middle. If the draw is lost, protect the slot first and match the two point threats.',
  zone: 'defensive-right',
  dot: { x: 72, y: 21 },
  drawTarget: 'US_RD',
  lostDrawTarget: 'OP_RD',
  losingResponse: 'Protect the slot first; wingers close the points while both defense players stay inside.',
  lostResolutionPhases: defensiveZoneLostPhases({ right: true }),
  home: {
    LW: homePlayer(52, 19.2, 'Outside the circle on the slot side. Seal their winger after the drop.'),
    C: homePlayer(72, 18.4, 'Square to their center with the stick set. Pull the draw behind you to RD.'),
    RW: homePlayer(92, 19.2, 'Outside the circle on the boards side. Release to the wall only after the drop.'),
    LD: homePlayer(51, 14.5, 'Weak-side support. Protect the middle and be ready for a reverse.'),
    RD: homePlayer(84, 11.5, 'Strong-side draw target. Stay behind C and present a clean receiving lane.'),
    G: HOME_GOALIE,
  },
  opponents: [
    opponentPlayer('op-c', 'C', 72, 23.6),
    opponentPlayer('op-rw', 'RW', 52, 22.8),
    opponentPlayer('op-lw', 'LW', 92, 22.8),
    opponentPlayer('op-ld', 'LD', 45, 33),
    opponentPlayer('op-rd', 'RD', 76, 33),
    OPPONENT_GOALIE,
  ],
  resolutionPhases: [
    {
      t: 'Draw Won to RD',
      desc: 'C pulls it behind the pressure. RD receives with the body open to the wall.',
      duration: 1.55,
      faceoffState: 'secured',
      ballOwner: 'US_RD',
      pos: {
        LW: homePlayer(51, 29, 'Stay inside as the middle outlet and defensive safety.', 'run'),
        C: homePlayer(71, 21, 'Finish the tie-up, then release underneath the wall option.', 'run'),
        RW: homePlayer(91, 29, 'Open on the right wall and show a clear target.', 'sprint', { comm: 'WALL!' }),
        LD: homePlayer(45, 10, 'Slide behind the net as the reverse option.', 'run', { comm: 'REVERSE!' }),
        RD: homePlayer(81, 13, 'Secure the draw, get the head up, and hit the first clean option.', 'hold', { ball: true }),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 70, 24),
        opponentPlayer('op-rw', 'RW', 58, 26),
        opponentPlayer('op-lw', 'LW', 87, 25),
        opponentPlayer('op-ld', 'LD', 45, 36),
        opponentPlayer('op-rd', 'RD', 75, 36),
        OPPONENT_GOALIE,
      ],
      ball: { x: 81, y: 13 },
      ballPath: [{ x: 72, y: 21 }, { x: 75, y: 19 }, { x: 78, y: 16 }, { x: 81, y: 13 }],
      lanes: [{ f: 'RD', t: 'RW', ty: 'primary' }, { f: 'RD', t: 'C', ty: 'secondary' }],
    },
    {
      t: 'Strong-Side Outlet',
      desc: 'RD moves it up the wall to RW while the middle lane stays supported.',
      duration: 1.9,
      faceoffState: 'execute',
      ballOwner: 'US_RW',
      pos: {
        LW: homePlayer(32, 40, 'Hold width on the far side and keep their defense spread.', 'sprint'),
        C: homePlayer(64, 34, 'Stay below the ball as the short middle option.', 'sprint'),
        RW: homePlayer(92, 40, 'Receive on the move and carry beyond the blue line.', 'sprint', { ball: true }),
        LD: homePlayer(48, 18, 'Advance through the middle as the back-side safety.', 'run'),
        RD: homePlayer(79, 22, 'Follow the pass and close the space behind RW.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 69, 31),
        opponentPlayer('op-rw', 'RW', 45, 34),
        opponentPlayer('op-lw', 'LW', 86, 34),
        opponentPlayer('op-ld', 'LD', 36, 49),
        opponentPlayer('op-rd', 'RD', 66, 48),
        OPPONENT_GOALIE,
      ],
      ball: { x: 92, y: 40 },
      ballPath: [{ x: 81, y: 13 }, { x: 89, y: 22 }, { x: 92, y: 31 }, { x: 92, y: 40 }],
      lanes: [{ f: 'RW', t: 'C', ty: 'primary' }],
    },
    {
      t: 'Controlled Zone Exit',
      desc: 'RW exits with support underneath and width across the floor.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: 'US_RW',
      pos: {
        LW: homePlayer(24, 49, 'Stretch the far side and remain a passing option.', 'sprint'),
        C: homePlayer(61, 44, 'Stay connected underneath the carrier.', 'sprint'),
        RW: homePlayer(90, 50, 'Carry through the neutral zone with the ball protected.', 'sprint', { ball: true }),
        LD: homePlayer(43, 28, 'Stay balanced behind the attack.', 'run'),
        RD: homePlayer(76, 31, 'Move up behind the play to hold the gap.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 66, 38),
        opponentPlayer('op-rw', 'RW', 42, 41),
        opponentPlayer('op-lw', 'LW', 82, 42),
        opponentPlayer('op-ld', 'LD', 34, 57),
        opponentPlayer('op-rd', 'RD', 65, 56),
        OPPONENT_GOALIE,
      ],
      ball: { x: 90, y: 50 },
      lanes: [{ f: 'RW', t: 'C', ty: 'secondary' }, { f: 'RW', t: 'LW', ty: 'outlet' }],
    },
  ],
});

const neutralZoneCenter = defineFaceoffPlay({
  id: 'nzfc',
  name: 'Center Faceoff - Quick-Up',
  category: 'neutral',
  description: 'Win the center draw back, move it once, and attack with three connected lanes.',
  strategy: 'C pulls the draw to LD. Both wingers release wide only after the ball is down. LD moves the ball immediately to the open side while RD supports underneath. If the draw is lost, all three forwards recover inside their checks.',
  zone: 'neutral-center',
  dot: { x: 50, y: 50 },
  drawTarget: 'US_LD',
  lostDrawTarget: 'OP_LD',
  losingResponse: 'Recover inside immediately; C tracks the middle while both wingers take away wide lanes.',
  lostResolutionPhases: neutralZoneLostPhases(),
  home: {
    LW: homePlayer(30, 48.2, 'Outside the center circle on our side. Release wide after the drop.'),
    C: homePlayer(50, 47.4, 'Square to their center. Pull the draw back and slightly left to LD.'),
    RW: homePlayer(70, 48.2, 'Outside the center circle on our side. Release wide after the drop.'),
    LD: homePlayer(34, 40, 'Primary draw target. Receive below the dot with the floor in front of you.'),
    RD: homePlayer(66, 40, 'Back-side support. Stay beneath the rush.'),
    G: HOME_GOALIE,
  },
  opponents: [
    opponentPlayer('op-c', 'C', 50, 52.6),
    opponentPlayer('op-rw', 'RW', 30, 51.8),
    opponentPlayer('op-lw', 'LW', 70, 51.8),
    opponentPlayer('op-ld', 'LD', 34, 60),
    opponentPlayer('op-rd', 'RD', 66, 60),
    OPPONENT_GOALIE,
  ],
  resolutionPhases: [
    {
      t: 'Draw Won to LD',
      desc: 'LD secures the backward draw while the three forwards release into lanes.',
      duration: 1.45,
      faceoffState: 'secured',
      ballOwner: 'US_LD',
      pos: {
        LW: homePlayer(21, 57, 'Release wide left and stay ahead of the ball.', 'sprint'),
        C: homePlayer(50, 55, 'Get above the tie-up and fill the middle lane.', 'sprint'),
        RW: homePlayer(79, 57, 'Release wide right and present the quick-up target.', 'sprint'),
        LD: homePlayer(39, 47, 'Secure the draw and turn the body toward the open wing.', 'run', { ball: true }),
        RD: homePlayer(63, 47, 'Close underneath as the safety and return option.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 50, 54),
        opponentPlayer('op-rw', 'RW', 34, 56),
        opponentPlayer('op-lw', 'LW', 70, 56),
        opponentPlayer('op-ld', 'LD', 35, 64),
        opponentPlayer('op-rd', 'RD', 65, 64),
        OPPONENT_GOALIE,
      ],
      ball: { x: 39, y: 47 },
      ballPath: [{ x: 50, y: 50 }, { x: 47, y: 49 }, { x: 43, y: 48 }, { x: 39, y: 47 }],
      lanes: [{ f: 'LD', t: 'RW', ty: 'primary' }, { f: 'LD', t: 'C', ty: 'secondary' }],
    },
    {
      t: 'One-Pass Attack',
      desc: 'LD hits RW in stride. C drives the middle and LW keeps the far side wide.',
      duration: 2,
      faceoffState: 'execute',
      ballOwner: 'US_RW',
      pos: {
        LW: homePlayer(17, 69, 'Hold the far lane and stay available across the floor.', 'sprint'),
        C: homePlayer(49, 68, 'Drive the middle and force both defense players to respect you.', 'sprint'),
        RW: homePlayer(82, 68, 'Receive in stride and attack through the outside lane.', 'sprint', { ball: true }),
        LD: homePlayer(38, 57, 'Follow as the high trailer.', 'run'),
        RD: homePlayer(64, 55, 'Stay underneath the rush as the safety.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 52, 60),
        opponentPlayer('op-rw', 'RW', 28, 62),
        opponentPlayer('op-lw', 'LW', 74, 63),
        opponentPlayer('op-ld', 'LD', 35, 72),
        opponentPlayer('op-rd', 'RD', 65, 72),
        OPPONENT_GOALIE,
      ],
      ball: { x: 82, y: 68 },
      ballPath: [{ x: 39, y: 47 }, { x: 54, y: 53 }, { x: 68, y: 60 }, { x: 82, y: 68 }],
      lanes: [{ f: 'RW', t: 'C', ty: 'primary' }, { f: 'RW', t: 'LW', ty: 'secondary' }],
    },
    {
      t: 'Three-Lane Entry',
      desc: 'The group enters with width, middle support, and both defense players underneath.',
      duration: 2.1,
      faceoffState: 'complete',
      ballOwner: 'US_RW',
      pos: {
        LW: homePlayer(18, 77, 'Arrive as the far-side option.', 'sprint'),
        C: homePlayer(48, 78, 'Drive inside the dots and be ready for the return pass.', 'sprint'),
        RW: homePlayer(78, 78, 'Enter under control and read the defense before passing.', 'sprint', { ball: true }),
        LD: homePlayer(36, 64, 'Stay high enough to support a turnover.', 'run'),
        RD: homePlayer(64, 63, 'Mirror LD and protect the middle.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 51, 67),
        opponentPlayer('op-rw', 'RW', 30, 70),
        opponentPlayer('op-lw', 'LW', 72, 71),
        opponentPlayer('op-ld', 'LD', 37, 82),
        opponentPlayer('op-rd', 'RD', 64, 82),
        OPPONENT_GOALIE,
      ],
      ball: { x: 78, y: 78 },
      lanes: [{ f: 'RW', t: 'C', ty: 'primary' }],
    },
  ],
});

const offensiveZoneLeft = defineFaceoffPlay({
  id: 'ozfl',
  name: 'O-Zone Faceoff - Left Shot',
  category: 'offensive',
  description: 'Pull the draw to LD and create an immediate low shot through layered traffic.',
  strategy: 'C wins the ball cleanly to LD. RW goes directly to the screen, C arrives as the inside tip option, and LW attacks the weak rebound. If the draw is lost, pressure the first outlet without abandoning the point structure.',
  zone: 'offensive-left',
  dot: { x: 28, y: 79 },
  drawTarget: 'US_LD',
  lostDrawTarget: 'OP_LD',
  losingResponse: 'Pressure the first outlet, keep both points covered, and do not send all three forwards below the ball.',
  lostResolutionPhases: offensiveZoneLostPhases(),
  home: {
    LW: homePlayer(8, 77.2, 'Outside the circle on the boards side. Attack the weak rebound after the drop.'),
    C: homePlayer(28, 76.4, 'Square to their center and pull the draw back to LD.'),
    RW: homePlayer(48, 77.2, 'Outside the circle on the slot side. Go to the screen after the drop.'),
    LD: homePlayer(19, 68, 'Primary draw target. Be ready to step into a quick shot.'),
    RD: homePlayer(63, 67, 'Weak-side point support. Hold the line and be ready for a blocked lane.'),
    G: HOME_GOALIE,
  },
  opponents: [
    opponentPlayer('op-c', 'C', 28, 81.6),
    opponentPlayer('op-rw', 'RW', 8, 80.8),
    opponentPlayer('op-lw', 'LW', 48, 80.8),
    opponentPlayer('op-ld', 'LD', 18, 90),
    opponentPlayer('op-rd', 'RD', 61, 87),
    OPPONENT_GOALIE,
  ],
  resolutionPhases: [
    {
      t: 'Draw Won to LD',
      desc: 'LD receives outside the circle while all three forwards create separate layers of traffic.',
      duration: 1.55,
      faceoffState: 'secured',
      ballOwner: 'US_LD',
      pos: {
        LW: homePlayer(18, 88, 'Arrive on the weak side for a rebound.', 'sprint'),
        C: homePlayer(42, 86, 'Release from the tie-up and arrive as the inside tip option.', 'sprint'),
        RW: homePlayer(50, 88, 'Set directly in the goalies sight line and hold the screen.', 'sprint'),
        LD: homePlayer(24, 70, 'Set the ball once and release it low through traffic.', 'hold', { ball: true }),
        RD: homePlayer(61, 70, 'Hold the opposite point as the reset option.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 82),
        opponentPlayer('op-rw', 'RW', 18, 82),
        opponentPlayer('op-lw', 'LW', 43, 84),
        opponentPlayer('op-ld', 'LD', 24, 89),
        opponentPlayer('op-rd', 'RD', 59, 88),
        OPPONENT_GOALIE,
      ],
      ball: { x: 24, y: 70 },
      ballPath: [{ x: 28, y: 79 }, { x: 27, y: 76 }, { x: 25, y: 73 }, { x: 24, y: 70 }],
      lanes: [{ f: 'LD', t: 'RD', ty: 'secondary' }],
    },
    {
      t: 'Low Shot Through Traffic',
      desc: 'LD releases immediately. RW screens, C offers the tip, and LW attacks the rebound.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: null,
      pos: {
        LW: homePlayer(30, 90, 'Attack the weak-side rebound with the stick ready.', 'sprint'),
        C: homePlayer(44, 89, 'Present the stick for a tip and continue through the rebound lane.', 'sprint'),
        RW: homePlayer(51, 89, 'Hold the screen until the shot reaches the net.', 'hold'),
        LD: homePlayer(28, 74, 'Follow the shot toward the slot for a second chance.', 'run'),
        RD: homePlayer(60, 72, 'Hold the line and be ready to keep a rebound in.', 'hold'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 36, 84),
        opponentPlayer('op-rw', 'RW', 24, 85),
        opponentPlayer('op-lw', 'LW', 46, 87),
        opponentPlayer('op-ld', 'LD', 31, 90),
        opponentPlayer('op-rd', 'RD', 59, 89),
        opponentPlayer('op-g', 'G', 52, 92),
      ],
      ball: { x: 54, y: 93 },
      ballPath: [{ x: 24, y: 70 }, { x: 34, y: 78 }, { x: 44, y: 86 }, { x: 54, y: 93 }],
      lanes: [],
    },
  ],
});

const powerPlayOffensiveZone = defineFaceoffPlay({
  id: 'ppfo',
  name: 'Power Play Faceoff - Point Shot',
  category: 'special',
  description: 'Use the extra runner to win the draw, establish traffic, and create an immediate point shot.',
  strategy: 'C pulls the draw to LD. RW occupies the net front, C releases into the inner lane, and LW attacks the weak rebound. The penalty-kill winger is off the floor; four defenders remain compact. If the draw is lost, pressure the clear without losing the two-point structure.',
  zone: 'power-play-offensive-left',
  dot: { x: 28, y: 79 },
  drawTarget: 'US_LD',
  lostDrawTarget: 'OP_LD',
  losingResponse: 'Pressure the first clear with the nearest forward while both point players hold the zone.',
  lostResolutionPhases: powerPlayLostPhases(),
  home: {
    LW: homePlayer(8, 77.2, 'Outside the circle on the boards side. Attack the weak rebound after the drop.'),
    C: homePlayer(28, 76.4, 'Square to their center and pull the draw back to LD.'),
    RW: homePlayer(48, 77.2, 'Outside the circle on the slot side. Establish the screen immediately.'),
    LD: homePlayer(20, 68, 'Primary draw target. Step into the shot before the box can expand.'),
    RD: homePlayer(63, 67, 'Weak-side point support and reset option.'),
    G: HOME_GOALIE,
  },
  opponents: [
    opponentPlayer('op-c', 'C', 28, 81.6),
    opponentPlayer('op-lw', 'LW', 48, 80.8),
    opponentPlayer('op-ld', 'LD', 18, 90),
    opponentPlayer('op-rd', 'RD', 61, 87),
    opponentPlayer('op-rw', 'RW', 98, 50, { inactive: true, status: 'penalty-box' }),
    OPPONENT_GOALIE,
  ],
  resolutionPhases: [
    {
      t: 'Draw Won to LD',
      desc: 'LD receives before the compact four-player unit can expand to the point.',
      duration: 1.5,
      faceoffState: 'secured',
      ballOwner: 'US_LD',
      pos: {
        LW: homePlayer(18, 88, 'Arrive weak side for the rebound.', 'sprint'),
        C: homePlayer(41, 86, 'Release inside and present the stick as the tip option.', 'sprint'),
        RW: homePlayer(50, 89, 'Take away the goalies sight line.', 'sprint'),
        LD: homePlayer(25, 70, 'Set it once and shoot before the penalty kill reaches you.', 'hold', { ball: true }),
        RD: homePlayer(61, 70, 'Hold the weak point for a blocked-lane reset.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 82),
        opponentPlayer('op-lw', 'LW', 43, 84),
        opponentPlayer('op-ld', 'LD', 26, 89),
        opponentPlayer('op-rd', 'RD', 59, 88),
        opponentPlayer('op-rw', 'RW', 98, 50, { inactive: true, status: 'penalty-box' }),
        OPPONENT_GOALIE,
      ],
      ball: { x: 25, y: 70 },
      ballPath: [{ x: 28, y: 79 }, { x: 27, y: 76 }, { x: 26, y: 73 }, { x: 25, y: 70 }],
      lanes: [{ f: 'LD', t: 'RD', ty: 'secondary' }],
    },
    {
      t: 'Shot Before the Box Expands',
      desc: 'The shot arrives through a screen while C and LW attack different rebound lanes.',
      duration: 2.2,
      faceoffState: 'complete',
      ballOwner: null,
      pos: {
        LW: homePlayer(31, 90, 'Attack the weak rebound.', 'sprint'),
        C: homePlayer(44, 89, 'Tip the shot or continue through the inside rebound lane.', 'sprint'),
        RW: homePlayer(51, 89, 'Hold the screen until the shot arrives.', 'hold'),
        LD: homePlayer(29, 74, 'Follow the shot and stay available for a loose ball.', 'run'),
        RD: homePlayer(60, 72, 'Hold the zone as the safety.', 'hold'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 37, 84),
        opponentPlayer('op-lw', 'LW', 46, 87),
        opponentPlayer('op-ld', 'LD', 31, 90),
        opponentPlayer('op-rd', 'RD', 59, 89),
        opponentPlayer('op-rw', 'RW', 98, 50, { inactive: true, status: 'penalty-box' }),
        opponentPlayer('op-g', 'G', 52, 92),
      ],
      ball: { x: 54, y: 93 },
      ballPath: [{ x: 25, y: 70 }, { x: 35, y: 78 }, { x: 45, y: 86 }, { x: 54, y: 93 }],
      lanes: [],
    },
  ],
});

const penaltyKillDefensiveZone = defineFaceoffPlay({
  id: 'pkfo',
  name: 'Penalty Kill Faceoff - Win and Clear',
  category: 'special',
  description: 'Win the defensive draw, secure it once, and clear through the strong-side wall.',
  strategy: 'C pulls the draw to LD. LW stays outside the circle and becomes the wall outlet. RD protects the front of the net while the penalized winger remains off the floor. If the draw is lost, the four active runners collapse into the box immediately.',
  zone: 'penalty-kill-defensive-left',
  dot: { x: 28, y: 21 },
  drawTarget: 'US_LD',
  lostDrawTarget: 'OP_LD',
  losingResponse: 'The four active runners form the box immediately: two inside the dots and two protecting the low slot.',
  lostResolutionPhases: penaltyKillLostPhases(),
  home: {
    LW: homePlayer(8, 19.2, 'Outside the circle on the boards side. Become the wall outlet after the drop.'),
    C: homePlayer(28, 18.4, 'Square to their center and pull the draw back to LD.'),
    RW: homePlayer(98, 50, 'Serving the penalty and off the playing surface.', 'hold', { inactive: true, status: 'penalty-box' }),
    LD: homePlayer(16, 11.5, 'Primary draw target. Secure it and move it to the wall immediately.'),
    RD: homePlayer(49, 13.5, 'Protect the net front and support the clear.'),
    G: HOME_GOALIE,
  },
  opponents: [
    opponentPlayer('op-c', 'C', 28, 23.6),
    opponentPlayer('op-rw', 'RW', 8, 22.8),
    opponentPlayer('op-lw', 'LW', 48, 22.8),
    opponentPlayer('op-ld', 'LD', 24, 33),
    opponentPlayer('op-rd', 'RD', 55, 33),
    OPPONENT_GOALIE,
  ],
  resolutionPhases: [
    {
      t: 'Draw Won to LD',
      desc: 'LD secures the draw while LW releases into the wall lane and RD protects the middle.',
      duration: 1.45,
      faceoffState: 'secured',
      ballOwner: 'US_LD',
      pos: {
        LW: homePlayer(8, 30, 'Release to the wall and present a safe clearing lane.', 'sprint', { comm: 'WALL!' }),
        C: homePlayer(30, 22, 'Finish the tie-up and stay between pressure and the ball.', 'run'),
        RW: homePlayer(98, 50, 'Serving the penalty and off the playing surface.', 'hold', { inactive: true, status: 'penalty-box' }),
        LD: homePlayer(19, 13, 'Control the ball and move it to LW without sending it across the slot.', 'hold', { ball: true }),
        RD: homePlayer(52, 13, 'Stay inside and protect the net front.', 'hold'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 31, 24),
        opponentPlayer('op-rw', 'RW', 14, 26),
        opponentPlayer('op-lw', 'LW', 42, 26),
        opponentPlayer('op-ld', 'LD', 25, 36),
        opponentPlayer('op-rd', 'RD', 55, 36),
        OPPONENT_GOALIE,
      ],
      ball: { x: 19, y: 13 },
      ballPath: [{ x: 28, y: 21 }, { x: 25, y: 19 }, { x: 22, y: 16 }, { x: 19, y: 13 }],
      lanes: [{ f: 'LD', t: 'LW', ty: 'primary' }],
    },
    {
      t: 'Wall Outlet',
      desc: 'LD moves it to LW on the wall. No pass crosses the middle of the defensive zone.',
      duration: 1.7,
      faceoffState: 'execute',
      ballOwner: 'US_LW',
      pos: {
        LW: homePlayer(7, 38, 'Receive on the wall and clear beyond the blue line.', 'sprint', { ball: true }),
        C: homePlayer(38, 32, 'Support underneath and block the inside pressure lane.', 'sprint'),
        RW: homePlayer(98, 50, 'Serving the penalty and off the playing surface.', 'hold', { inactive: true, status: 'penalty-box' }),
        LD: homePlayer(22, 21, 'Follow the play and protect the strong-side lane.', 'run'),
        RD: homePlayer(51, 17, 'Stay inside until the clear is safely away.', 'hold'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 33, 30),
        opponentPlayer('op-rw', 'RW', 13, 34),
        opponentPlayer('op-lw', 'LW', 48, 33),
        opponentPlayer('op-ld', 'LD', 28, 43),
        opponentPlayer('op-rd', 'RD', 58, 42),
        OPPONENT_GOALIE,
      ],
      ball: { x: 7, y: 38 },
      ballPath: [{ x: 19, y: 13 }, { x: 10, y: 22 }, { x: 7, y: 30 }, { x: 7, y: 38 }],
      lanes: [],
    },
    {
      t: 'Clear the Zone',
      desc: 'LW sends the ball beyond the blue line while the other three active runners recover shape.',
      duration: 2.1,
      faceoffState: 'complete',
      ballOwner: null,
      pos: {
        LW: homePlayer(9, 46, 'Finish the clear and recover inside.', 'sprint'),
        C: homePlayer(42, 39, 'Recover through the middle after supporting the outlet.', 'sprint'),
        RW: homePlayer(98, 50, 'Serving the penalty and off the playing surface.', 'hold', { inactive: true, status: 'penalty-box' }),
        LD: homePlayer(25, 28, 'Close behind the clear and rebuild the box.', 'run'),
        RD: homePlayer(54, 25, 'Stay inside and rebuild the low side of the box.', 'run'),
        G: HOME_GOALIE,
      },
      opp: [
        opponentPlayer('op-c', 'C', 35, 36),
        opponentPlayer('op-rw', 'RW', 17, 41),
        opponentPlayer('op-lw', 'LW', 51, 40),
        opponentPlayer('op-ld', 'LD', 30, 50),
        opponentPlayer('op-rd', 'RD', 60, 49),
        OPPONENT_GOALIE,
      ],
      ball: { x: 8, y: 54 },
      ballPath: [{ x: 7, y: 38 }, { x: 6, y: 44 }, { x: 7, y: 49 }, { x: 8, y: 54 }],
      lanes: [],
    },
  ],
});

export const FACE_OFF_PLAYS = [
  dZoneLeft,
  dZoneRight,
  neutralZoneCenter,
  offensiveZoneLeft,
  powerPlayOffensiveZone,
  penaltyKillDefensiveZone,
];

export const FACE_OFF_PLAY_IDS = FACE_OFF_PLAYS.map((play) => play.id);

export const FACE_OFF_PLAY_BY_ID = Object.freeze(Object.fromEntries(
  FACE_OFF_PLAYS.map((play) => [play.id, play]),
));
