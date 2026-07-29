import { samplePlayScene } from './samplePlayScene';

const HOME_ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];

function movementLabel(action) {
  if (action === 'sprint-forward') return 'sprint';
  if (action === 'jog-forward') return 'run';
  if (action === 'goalie-ready') return 'drift';
  return 'hold';
}

function currentPassingLane(frame) {
  const fromPlayer = frame.players.find((player) => player.id === frame.ball.fromPlayerId);
  const toPlayer = frame.players.find((player) => player.id === frame.ball.toPlayerId);
  if (!fromPlayer || !toPlayer || fromPlayer.team !== 'us' || toPlayer.team !== 'us') return [];

  return [{
    f: fromPlayer.role,
    t: toPlayer.role,
    ty: frame.ball.segmentType === 'board-pass' ? 'primary' : 'secondary',
  }];
}

export function playSceneToRinkPhase(scene, requestedTime) {
  const frame = samplePlayScene(scene, requestedTime);
  const homePlayers = frame.players.filter((player) => player.team === 'us');
  const opponentPlayers = frame.players.filter((player) => player.team === 'opponent');
  const pos = Object.fromEntries(HOME_ROLES.map((role) => {
    const player = homePlayers.find((item) => item.role === role);
    if (!player) return [role, null];

    return [role, {
      x: player.position.x,
      y: player.position.y,
      role: player.label || player.role,
      u: movementLabel(player.action),
      ball: frame.ball.ownerId === player.id,
      inactive: player.active === false,
      status: player.status,
    }];
  }));

  return {
    id: `${scene.id}@${frame.time.toFixed(2)}`,
    time: frame.time,
    t: frame.event?.label ?? scene.title,
    desc: frame.event?.label ?? scene.teachingPoints?.[0] ?? '',
    pos,
    opp: opponentPlayers.map((player) => ({
      id: player.id,
      x: player.position.x,
      y: player.position.y,
      l: player.label || player.role,
      hasBall: frame.ball.ownerId === player.id,
      inactive: player.active === false,
      status: player.status,
    })),
    ball: { x: frame.ball.position.x, y: frame.ball.position.y },
    ballPath: frame.ball.path ?? null,
    lanes: currentPassingLane(frame),
    sceneFrame: frame,
  };
}
