import { useMemo, useRef } from 'react';
import {
  PLAYMAKER_ROSTER,
  playmakerBoardImpact,
  playmakerPlayerById,
  resolvePlaymakerBallDecision,
} from './playmakerModel';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toSvgY = (rinkY) => 200 - rinkY * 2;

function playerPositionMap(frame, sampledPlayers) {
  if (sampledPlayers) {
    return new Map(sampledPlayers.map((player) => [player.id, player.position]));
  }
  return new Map(Object.entries(frame.players).map(([id, player]) => [id, player]));
}

function BallMarker({ ball, positions }) {
  const position = ball?.position
    ?? (ball?.ownerId ? positions.get(ball.ownerId) : ball?.target);
  if (!position) return null;
  return (
    <g className="playmaker-ball-marker" transform={`translate(${position.x} ${toSvgY(position.y)})`}>
      <circle r="2.15" />
      <circle r="3.2" className="playmaker-ball-marker-ring" />
    </g>
  );
}

function passDecision(source, destination) {
  const decision = resolvePlaymakerBallDecision(source, destination);
  return decision && ['pass', 'board-pass'].includes(decision.type)
    && decision.fromPlayerId && decision.toPlayerId
    ? decision
    : null;
}

function BallDecisionPreview({ frame, nextFrame, previousFrame }) {
  const decision = passDecision(frame, nextFrame) ?? passDecision(previousFrame, frame);
  if (!decision) return null;

  const source = playmakerPlayerById(decision.fromPlayerId);
  const receiver = playmakerPlayerById(decision.toPlayerId);
  if (!source || !receiver) return null;
  const start = { x: decision.start.x, y: toSvgY(decision.start.y) };
  const end = { x: decision.end.x, y: toSvgY(decision.end.y) };
  const label = `${source.label} to ${receiver.label}`;
  const labelWidth = Math.max(20, label.length * 2.15 + 6);
  const labelX = clamp((start.x + end.x) / 2, labelWidth / 2 + 3, 97 - labelWidth / 2);
  const labelY = clamp((start.y + end.y) / 2 - 7, 9, 191);
  const path = decision.type === 'board-pass'
    ? (() => {
      const impact = playmakerBoardImpact(decision.start, decision.end);
      return `M ${start.x} ${start.y} L ${impact.x} ${toSvgY(impact.y)} L ${end.x} ${end.y}`;
    })()
    : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  return (
    <g
      className={`playmaker-ball-decision is-${decision.type}`}
      data-testid="playmaker-ball-decision"
      data-from-player-id={decision.fromPlayerId}
      data-receiver-id={decision.toPlayerId}
      aria-label={`${source.label} passes to ${receiver.label}`}
    >
      <path d={path} markerEnd="url(#playmaker-pass-arrow)" />
      <circle className="playmaker-receiver-ring" cx={end.x} cy={end.y} r="6.4" />
      <g className="playmaker-pass-label" transform={`translate(${labelX} ${labelY})`}>
        <rect x={-labelWidth / 2} y="-4" width={labelWidth} height="8" rx="2" />
        <text y="1">{label}</text>
      </g>
    </g>
  );
}

export default function PlaymakerCourt({
  ball,
  frame,
  interactive = true,
  nextFrame = null,
  onMovePlayer,
  onPlaceBallTarget,
  onSelectPlayer,
  previousFrame = null,
  sampledPlayers = null,
  selectedPlayerId,
  targetMode = false,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const positions = useMemo(
    () => playerPositionMap(frame, sampledPlayers),
    [frame, sampledPlayers],
  );

  const rinkPointFromPointer = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 2, 98),
      y: clamp(100 - ((event.clientY - rect.top) / rect.height) * 100, 2, 98),
    };
  };

  const startDrag = (event, playerId) => {
    event.stopPropagation();
    onSelectPlayer(playerId);
    if (!interactive || targetMode) return;
    dragRef.current = { playerId, pointerId: event.pointerId };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    onMovePlayer(dragRef.current.playerId, rinkPointFromPointer(event), { transient: true });
  };

  const finishDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const { playerId } = dragRef.current;
    onMovePlayer(playerId, rinkPointFromPointer(event), { transient: false });
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleCourtPointerDown = (event) => {
    if (targetMode) onPlaceBallTarget(rinkPointFromPointer(event));
  };

  const nudgeSelected = (event) => {
    if (!interactive || !selectedPlayerId) return;
    const deltas = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const current = positions.get(selectedPlayerId);
    const step = event.shiftKey ? 3 : 1;
    onMovePlayer(selectedPlayerId, {
      x: clamp(current.x + delta[0] * step, 2, 98),
      y: clamp(current.y + delta[1] * step, 2, 98),
    }, { transient: false });
  };

  return (
    <svg
      ref={svgRef}
      className={`playmaker-court ${targetMode ? 'is-targeting' : ''}`}
      viewBox="0 0 100 200"
      role="application"
      aria-label="Playmaker court. Drag players or use arrow keys to position the selected player."
      tabIndex={0}
      onKeyDown={nudgeSelected}
      onPointerDown={handleCourtPointerDown}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <defs>
        <marker id="playmaker-pass-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0 0 L5 2.5 L0 5 Z" />
        </marker>
      </defs>
      <rect className="playmaker-court-surface" x="2" y="2" width="96" height="196" rx="11" />
      <line className="playmaker-line playmaker-line-red" x1="4" y1="100" x2="96" y2="100" />
      <line className="playmaker-line playmaker-line-blue" x1="4" y1="72" x2="96" y2="72" />
      <line className="playmaker-line playmaker-line-blue" x1="4" y1="128" x2="96" y2="128" />
      <line className="playmaker-line playmaker-line-goal" x1="12" y1="12" x2="88" y2="12" />
      <line className="playmaker-line playmaker-line-goal" x1="12" y1="188" x2="88" y2="188" />
      <circle className="playmaker-faceoff-circle" cx="50" cy="100" r="9" />
      {[28, 72].flatMap((x) => [42, 158].map((y) => (
        <g key={`${x}-${y}`}>
          <circle className="playmaker-faceoff-circle" cx={x} cy={y} r="10" />
          <circle className="playmaker-faceoff-dot" cx={x} cy={y} r="0.8" />
          <line className="playmaker-hash" x1={x - 13} y1={y - 3} x2={x - 9} y2={y - 3} />
          <line className="playmaker-hash" x1={x + 9} y1={y - 3} x2={x + 13} y2={y - 3} />
          <line className="playmaker-hash" x1={x - 13} y1={y + 3} x2={x - 9} y2={y + 3} />
          <line className="playmaker-hash" x1={x + 9} y1={y + 3} x2={x + 13} y2={y + 3} />
        </g>
      )))}
      {[32, 50, 68].flatMap((x) => [90, 110].map((y) => (
        <circle key={`${x}-${y}`} className="playmaker-neutral-dot" cx={x} cy={y} r="0.65" />
      )))}
      <path className="playmaker-crease" d="M42 12 A8 8 0 0 0 58 12" />
      <path className="playmaker-crease" d="M42 188 A8 8 0 0 1 58 188" />
      <g className="playmaker-net playmaker-net-away">
        <path d="M43 12 L43 7 L57 7 L57 12" />
      </g>
      <g className="playmaker-net playmaker-net-home">
        <path d="M43 188 L43 193 L57 193 L57 188" />
      </g>

      {interactive && !targetMode && (
        <BallDecisionPreview frame={frame} nextFrame={nextFrame} previousFrame={previousFrame} />
      )}

      {PLAYMAKER_ROSTER.map((player) => {
        const position = positions.get(player.id);
        const selected = player.id === selectedPlayerId;
        const transform = `translate(${position.x} ${toSvgY(position.y)})`;
        return (
          <g
            key={player.id}
            className={`playmaker-player is-${player.team} ${selected ? 'is-selected' : ''}`}
            transform={transform}
            role="button"
            tabIndex={0}
            aria-label={`${player.team === 'us' ? 'Our' : 'Opponent'} ${player.label}`}
            onPointerDown={(event) => startDrag(event, player.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelectPlayer(player.id);
            }}
          >
            <circle className="playmaker-player-hit-target" r="8.5" />
            {selected && <circle className="playmaker-player-selection" r="6" />}
            {player.role === 'G'
              ? <rect x="-4" y="-3" width="8" height="6" rx="1.2" />
              : <circle r="4.1" />}
            <text y="0.4">{player.label}</text>
          </g>
        );
      })}

      <BallMarker ball={ball ?? frame.ball} positions={positions} />
      {targetMode && (
        <g className="playmaker-target-cursor" transform={`translate(${frame.ball.target.x} ${toSvgY(frame.ball.target.y)})`}>
          <circle r="4" />
          <line x1="-6" y1="0" x2="6" y2="0" />
          <line x1="0" y1="-6" x2="0" y2="6" />
        </g>
      )}
    </svg>
  );
}
