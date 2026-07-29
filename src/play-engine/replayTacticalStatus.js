function playerLabel(frame, playerId) {
  return frame?.players?.find((player) => player.id === playerId)?.label ?? null;
}

export function replayPossessionLabel(frame) {
  const owner = playerLabel(frame, frame?.ball?.ownerId);
  if (owner) return owner;

  if (frame?.ball?.stickContact === 'release') {
    return playerLabel(frame, frame.ball.fromPlayerId) ?? 'IN FLIGHT';
  }

  if (frame?.ball?.stickContact === 'receive') {
    return playerLabel(frame, frame.ball.toPlayerId) ?? 'IN FLIGHT';
  }

  if (frame?.ball?.segmentType === 'pass' || frame?.ball?.segmentType === 'board-pass') {
    return 'IN FLIGHT';
  }

  return 'LOOSE BALL';
}

export function replayNextRead(frame) {
  return frame?.event?.nextRead ?? 'Settle the ball and shoulder-check pressure';
}
