import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { mirrorPhase } from '../utils/mirror';
import { POSITIONS, BALL_COLOR } from '../data/plays';

const W = 380, H = 660, PD = 14;
const toX = p => (p / 100) * (W - PD * 2) + PD;
const toY = p => H - ((p / 100) * (H - PD * 2) + PD);

function RinkMarkings({ t, glY1, glY2, cx }) {
  const fcDots = [[W * 0.3, H * 0.78], [W * 0.7, H * 0.78], [W * 0.3, H * 0.22], [W * 0.7, H * 0.22]];
  const fcR = 28;
  return (
    <>
      {/* Goal lines */}
      <line x1={PD} y1={glY1} x2={W - PD} y2={glY1} stroke="#dc2626" strokeWidth={2.5} opacity={0.7} />
      <line x1={PD} y1={glY2} x2={W - PD} y2={glY2} stroke="#dc2626" strokeWidth={2.5} opacity={0.7} />
      {/* Creases */}
      <path d={`M ${cx - 22} ${glY1} Q ${cx - 22} ${glY1 - 26} ${cx} ${glY1 - 26} Q ${cx + 22} ${glY1 - 26} ${cx + 22} ${glY1}`} fill="rgba(59,130,246,.1)" stroke="#3b82f6" strokeWidth={1.2} />
      <path d={`M ${cx - 22} ${glY2} Q ${cx - 22} ${glY2 + 26} ${cx} ${glY2 + 26} Q ${cx + 22} ${glY2 + 26} ${cx + 22} ${glY2}`} fill="rgba(239,68,68,.1)" stroke="#ef4444" strokeWidth={1.2} />
      {/* Nets */}
      <rect x={cx - 14} y={glY1} width={28} height={7} rx={2} fill="none" stroke="#3b82f6" strokeWidth={1.3} opacity={0.5} />
      <rect x={cx - 14} y={glY2 - 7} width={28} height={7} rx={2} fill="none" stroke="#ef4444" strokeWidth={1.3} opacity={0.5} />
      {/* Center and blue lines */}
      <line x1={PD} y1={H / 2} x2={W - PD} y2={H / 2} stroke="#dc2626" strokeWidth={2} opacity={0.5} />
      <line x1={PD} y1={H * 0.36} x2={W - PD} y2={H * 0.36} stroke="#2563eb" strokeWidth={2.5} opacity={0.4} />
      <line x1={PD} y1={H * 0.64} x2={W - PD} y2={H * 0.64} stroke="#2563eb" strokeWidth={2.5} opacity={0.4} />
      {/* Center circle and dot */}
      <circle cx={cx} cy={H / 2} r={34} fill="none" stroke="#2563eb" strokeWidth={1.2} opacity={0.35} />
      <circle cx={cx} cy={H / 2} r={3} fill="#dc2626" opacity={0.5} />
      {/* Faceoff circles with hash marks */}
      {fcDots.map(([fx, fy], i) => (
        <g key={`fc${i}`}>
          <circle cx={fx} cy={fy} r={fcR} fill="none" stroke="#dc2626" strokeWidth={2} opacity={0.55} />
          <circle cx={fx} cy={fy} r={3.5} fill="#dc2626" opacity={0.65} />
          <line x1={fx - fcR} y1={fy - 4} x2={fx - fcR - 8} y2={fy - 4} stroke="#dc2626" strokeWidth={2} opacity={0.5} />
          <line x1={fx - fcR} y1={fy + 4} x2={fx - fcR - 8} y2={fy + 4} stroke="#dc2626" strokeWidth={2} opacity={0.5} />
          <line x1={fx + fcR} y1={fy - 4} x2={fx + fcR + 8} y2={fy - 4} stroke="#dc2626" strokeWidth={2} opacity={0.5} />
          <line x1={fx + fcR} y1={fy + 4} x2={fx + fcR + 8} y2={fy + 4} stroke="#dc2626" strokeWidth={2} opacity={0.5} />
        </g>
      ))}
      {/* Zone labels */}
      <text x={cx} y={glY1 - 32} textAnchor="middle" fill={t.td} fontSize={8} fontFamily="monospace" opacity={0.4}>OUR ZONE</text>
      <text x={cx} y={glY2 + 40} textAnchor="middle" fill={t.td} fontSize={8} fontFamily="monospace" opacity={0.4}>THEIR ZONE</text>
    </>
  );
}

function MovementTrails({ prev, rph, sel, t }) {
  if (!prev) return null;
  return POSITIONS.filter(p => p !== 'G').map(pos => {
    const pr = prev[pos], cu = rph.pos[pos];
    if (!pr || !cu) return null;
    const x1 = toX(pr.x), y1 = toY(pr.y), x2 = toX(cu.x), y2 = toY(cu.y);
    if (Math.abs(x1 - x2) < 3 && Math.abs(y1 - y2) < 3) return null;
    return (
      <line key={`t${pos}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={pos === sel ? t.sc : t.pc[pos]}
        strokeWidth={pos === sel ? 2.5 : 1.5}
        strokeDasharray="6,4"
        opacity={pos === sel ? 0.55 : 0.2} />
    );
  });
}

function PassingLanes({ rph }) {
  if (!rph.lanes) return null;
  return rph.lanes.map((ln, i) => {
    const fr = rph.pos[ln.f], to = rph.pos[ln.t];
    if (!fr || !to) return null;
    const x1 = toX(fr.x), y1 = toY(fr.y), x2 = toX(to.x), y2 = toY(to.y);
    const cl = { primary: '#eab308', secondary: '#737373', outlet: '#525252' }[ln.ty];
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return null;
    const ux = dx / len, uy = dy / len, ax = x2 - ux * 13, ay = y2 - uy * 13;
    return (
      <g key={`l${i}`} opacity={0.4}>
        <line x1={x1} y1={y1} x2={ax} y2={ay} stroke={cl} strokeWidth={1.5} strokeDasharray="4,4" />
        <polygon points={`${ax - uy * 3.5},${ay + ux * 3.5} ${x2 - ux * 5},${y2 - uy * 5} ${ax + uy * 3.5},${ay - ux * 3.5}`} fill={cl} />
      </g>
    );
  });
}

function PlayerDots({ rph, sel, t, theme }) {
  return POSITIONS.map(pos => {
    const p = rph.pos[pos];
    if (!p) return null;
    const s = pos === sel, ox = toX(p.x), oy = toY(p.y), r = s ? 14 : 10;
    const c = s ? t.sc : t.pc[pos];
    return (
      <g key={pos}>
        {s && (
          <circle cx={ox} cy={oy} r={r + 5} fill="none" stroke={t.sc} strokeWidth={1.3} opacity={0.3}>
            <animate attributeName="r" values={`${r + 3};${r + 8};${r + 3}`} dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        {p.u === 'sprint' && (
          <circle cx={ox} cy={oy} r={r + 2} fill="none" stroke={c} strokeWidth={0.7} opacity={0.35} strokeDasharray="3,3">
            <animate attributeName="r" values={`${r + 1};${r + 5};${r + 1}`} dur="1s" repeatCount="indefinite" />
          </circle>
        )}
        <motion.circle
          animate={{ cx: ox, cy: oy }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          r={r} fill={c} opacity={s ? 1 : 0.85}
          stroke={s ? (theme === 'dark' ? '#fff' : '#0a0e1a') : 'none'}
          strokeWidth={s ? 2 : 0}
          style={{ filter: s ? `drop-shadow(0 0 5px ${t.sc})` : 'none' }}
        />
        <motion.text
          animate={{ x: ox, y: oy + 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          textAnchor="middle" dominantBaseline="central"
          fill={s ? t.dt : '#fff'} fontSize={s ? 9 : 8}
          fontWeight="bold" fontFamily="monospace"
        >{pos}</motion.text>
      </g>
    );
  });
}

function OpponentDots({ rph, t, theme }) {
  if (!rph.opp) return null;
  const neon = t.oc;
  return rph.opp.map(o => {
    const ox = toX(o.x), oy = toY(o.y);
    return (
      <g key={o.id} style={{ filter: theme === 'dark' ? 'url(#ng)' : 'none' }}>
        <motion.circle animate={{ cx: ox, cy: oy }} transition={{ duration: 0.6, ease: 'easeOut' }} r={10} fill={t.rk} opacity={0.9} />
        <motion.circle animate={{ cx: ox, cy: oy }} transition={{ duration: 0.6, ease: 'easeOut' }} r={10} fill="none" stroke={neon} strokeWidth={2} opacity={theme === 'dark' ? 0.95 : 0.75} />
        <motion.circle animate={{ cx: ox, cy: oy }} transition={{ duration: 0.6, ease: 'easeOut' }} r={9} fill={neon} opacity={0.08} />
        <motion.text
          animate={{ x: ox, y: oy + 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          textAnchor="middle" dominantBaseline="central"
          fill={neon} fontSize={8} fontWeight="bold" fontFamily="monospace" opacity={0.95}
        >{o.l}</motion.text>
      </g>
    );
  });
}

function BallIndicator({ rph, sel }) {
  if (!rph.ball) return null;
  let bx = toX(rph.ball.x), by = toY(rph.ball.y);
  const carrier = POSITIONS.find(pos => rph.pos[pos]?.ball);
  if (carrier) {
    const cp = rph.pos[carrier];
    const cpx = toX(cp.x), cpy = toY(cp.y);
    const r = carrier === sel ? 14 : 10;
    let dx = bx - cpx, dy = by - cpy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) { dx = 1; dy = -1; }
    const ux = dx / (dist || 1), uy = dy / (dist || 1);
    bx = cpx + ux * (r + 4);
    by = cpy + uy * (r + 4);
  }
  return (
    <g>
      <circle cx={bx} cy={by} r={7} fill={BALL_COLOR} opacity={0.2}>
        <animate attributeName="r" values="7;11;7" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={bx} cy={by} r={6} fill={BALL_COLOR} />
      <circle cx={bx} cy={by} r={6} fill="none" stroke="#fff" strokeWidth={1} opacity={0.4} />
    </g>
  );
}

export default function RinkSVG() {
  const { theme, themes } = useTheme();
  const { selectedPosition, currentPlay, currentPhase, isMirrored, showOpponents, previousPositions } = useApp();
  const t = themes[theme];
  const ph = currentPlay?.phases[currentPhase];
  if (!ph) return null;

  const rph = isMirrored ? mirrorPhase(ph) : ph;
  const rprev = isMirrored && previousPositions
    ? (() => {
        const fl = p => ({ ...p, x: 100 - p.x });
        return { LW: fl(previousPositions.RW), C: fl(previousPositions.C), RW: fl(previousPositions.LW), LD: fl(previousPositions.RD), RD: fl(previousPositions.LD), G: fl(previousPositions.G) };
      })()
    : previousPositions;

  const glY1 = toY(6), glY2 = toY(94), cx = W / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 380 }}>
      <defs>
        <radialGradient id="rg">
          <stop offset="0%" stopColor={theme === 'dark' ? '#141e33' : '#dae2ee'} />
          <stop offset="100%" stopColor={t.rk} />
        </radialGradient>
        <filter id="ng">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Rink outline */}
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={52} fill="url(#rg)" stroke={t.rs} strokeWidth={2.5} />
      <RinkMarkings t={t} glY1={glY1} glY2={glY2} cx={cx} />
{/* Center ice logo */}
      <image
        href="/goonsquad.png"
        x={W / 2 - 153}
        y={H * 0.31}
        width={306}
        height={H * 0.34}
        opacity={theme === 'dark' ? 0.08 : 0.12}
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: 'none' }}
      />
      <MovementTrails prev={rprev} rph={rph} sel={selectedPosition} t={t} />
      <PassingLanes rph={rph} />
      <PlayerDots rph={rph} sel={selectedPosition} t={t} theme={theme} />
      {showOpponents && <OpponentDots rph={rph} t={t} theme={theme} />}
      <BallIndicator rph={rph} sel={selectedPosition} />
    </svg>
  );
}
