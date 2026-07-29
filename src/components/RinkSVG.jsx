import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { mirrorPhase } from '../utils/mirror';
import { POSITIONS, BALL_COLOR } from '../data/plays';
import { rolesForRoleLens } from '../play-engine/teamJobs';

const W = 380, H = 660, PD = 14;
const toX = p => (p / 100) * (W - PD * 2) + PD;
const toY = p => H - ((p / 100) * (H - PD * 2) + PD);
const hasPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const PLAYER_ANIM_S = 0.6;
const MotionLine = motion.line;
const MotionCircle = motion.circle;
const MotionText = motion.text;
const MotionG = motion.g;

function CoverageLines({ coverage, rph }) {
  if (!coverage) return null;
  return POSITIONS.filter(p => p !== 'G').map(pos => {
    const oppId = coverage[pos];
    if (!oppId) return null;
    const our = rph.pos[pos];
    const opp = rph.opp?.find(o => o.id === oppId);
    if (!our || !opp) return null;
    const x1 = toX(our.x), y1 = toY(our.y);
    const x2 = toX(opp.x), y2 = toY(opp.y);
    const dx = our.x - opp.x, dy = our.y - opp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const color = dist < 15 ? '#16a34a' : dist < 25 ? '#d97706' : '#dc2626';
    return (
      <MotionLine
        key={`cov-${pos}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        initial={{ x1, y1, x2, y2, stroke: color }}
        animate={{ x1, y1, x2, y2, stroke: color }}
        transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }}
        strokeWidth={1.2}
        strokeDasharray="4,4"
        opacity={0.55}
      />
    );
  });
}

function RinkMarkings({ t, glY1, glY2, cx, isDark }) {
  const fcDots = [[W * 0.3, H * 0.78], [W * 0.7, H * 0.78], [W * 0.3, H * 0.22], [W * 0.7, H * 0.22]];
  const fcR = 28;
  // Higher contrast in dark mode
  const glOpacity     = isDark ? 0.85 : 0.7;
  const blueOp        = isDark ? 0.55 : 0.4;
  const centerCircOp  = isDark ? 0.5  : 0.35;
  const fcOp          = isDark ? 0.7  : 0.55;
  const creaseBlue    = isDark ? 'rgba(59,130,246,.22)'  : 'rgba(59,130,246,.1)';
  const creaseRed     = isDark ? 'rgba(239,68,68,.22)'   : 'rgba(239,68,68,.1)';

  return (
    <>
      {/* Goal lines */}
      <line x1={PD} y1={glY1} x2={W - PD} y2={glY1} stroke="#dc2626" strokeWidth={2.5} opacity={glOpacity} />
      <line x1={PD} y1={glY2} x2={W - PD} y2={glY2} stroke="#dc2626" strokeWidth={2.5} opacity={glOpacity} />
      {/* Our crease (bottom) */}
      <path d={`M ${cx - 22} ${glY1} Q ${cx - 22} ${glY1 - 26} ${cx} ${glY1 - 26} Q ${cx + 22} ${glY1 - 26} ${cx + 22} ${glY1}`} fill={creaseBlue} stroke="#3b82f6" strokeWidth={1.2} />
      {/* Their crease (top) */}
      <path d={`M ${cx - 22} ${glY2} Q ${cx - 22} ${glY2 + 26} ${cx} ${glY2 + 26} Q ${cx + 22} ${glY2 + 26} ${cx + 22} ${glY2}`} fill={creaseRed} stroke="#ef4444" strokeWidth={1.2} />
      {/* Our net box */}
      <rect x={cx - 14} y={glY1} width={28} height={7} rx={2} fill="none" stroke="#3b82f6" strokeWidth={1.3} opacity={0.6} />
      {/* Their net box */}
      <rect x={cx - 14} y={glY2 - 7} width={28} height={7} rx={2} fill="none" stroke="#ef4444" strokeWidth={1.3} opacity={0.6} />
      {/* Red center line */}
      <line x1={PD} y1={H / 2} x2={W - PD} y2={H / 2} stroke="#dc2626" strokeWidth={2} opacity={0.5} />
      {/* Blue lines */}
      <line x1={PD} y1={H * 0.36} x2={W - PD} y2={H * 0.36} stroke="#2563eb" strokeWidth={2.5} opacity={blueOp} />
      <line x1={PD} y1={H * 0.64} x2={W - PD} y2={H * 0.64} stroke="#2563eb" strokeWidth={2.5} opacity={blueOp} />
      {/* Center circle */}
      <circle cx={cx} cy={H / 2} r={34} fill="none" stroke="#2563eb" strokeWidth={1.2} opacity={centerCircOp} />
      <circle cx={cx} cy={H / 2} r={3} fill="#dc2626" opacity={0.6} />
      {/* Faceoff circles + dots */}
      {fcDots.map(([fx, fy], i) => (
        <g key={`fc${i}`}>
          <circle cx={fx} cy={fy} r={fcR} fill="none" stroke="#dc2626" strokeWidth={2} opacity={fcOp} />
          <circle cx={fx} cy={fy} r={3.5} fill="#dc2626" opacity={0.7} />
          <line x1={fx - fcR} y1={fy - 4} x2={fx - fcR - 8} y2={fy - 4} stroke="#dc2626" strokeWidth={2} opacity={fcOp - 0.1} />
          <line x1={fx - fcR} y1={fy + 4} x2={fx - fcR - 8} y2={fy + 4} stroke="#dc2626" strokeWidth={2} opacity={fcOp - 0.1} />
          <line x1={fx + fcR} y1={fy - 4} x2={fx + fcR + 8} y2={fy - 4} stroke="#dc2626" strokeWidth={2} opacity={fcOp - 0.1} />
          <line x1={fx + fcR} y1={fy + 4} x2={fx + fcR + 8} y2={fy + 4} stroke="#dc2626" strokeWidth={2} opacity={fcOp - 0.1} />
        </g>
      ))}
      {/* Zone labels */}
      <text x={cx} y={glY1 - 32} textAnchor="middle" fill={t.tm} fontSize={8} fontFamily="monospace" opacity={isDark ? 0.45 : 0.35}>OUR ZONE</text>
      <text x={cx} y={glY2 + 40} textAnchor="middle" fill={t.tm} fontSize={8} fontFamily="monospace" opacity={isDark ? 0.45 : 0.35}>THEIR ZONE</text>
    </>
  );
}

function MovementTrails({ focusedRoles, prev, rph, t }) {
  if (!prev) return null;
  return POSITIONS.filter(p => p !== 'G').map(pos => {
    const pr = prev[pos], cu = rph.pos[pos];
    if (!pr || !cu) return null;
    const x1 = toX(pr.x), y1 = toY(pr.y), x2 = toX(cu.x), y2 = toY(cu.y);
    if (Math.abs(x1 - x2) < 3 && Math.abs(y1 - y2) < 3) return null;
    const focused = focusedRoles.has(pos);
    return (
      <line key={`t${pos}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={focused ? t.sc : t.pc[pos]}
        strokeWidth={focused ? 2.5 : 1.5}
        strokeDasharray="6,4"
        opacity={focused ? 0.6 : 0.22} />
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
      <g key={`l${i}`} opacity={0.42}>
        <line x1={x1} y1={y1} x2={ax} y2={ay} stroke={cl} strokeWidth={1.5} strokeDasharray="4,4" />
        <polygon points={`${ax - uy * 3.5},${ay + ux * 3.5} ${x2 - ux * 5},${y2 - uy * 5} ${ax + uy * 3.5},${ay - ux * 3.5}`} fill={cl} />
      </g>
    );
  });
}

function TacticalArrows({ arrows }) {
  if (!arrows || arrows.length === 0) return null;
  return arrows.map((a, i) => {
    const x1 = toX(a.from.x), y1 = toY(a.from.y);
    const x2 = toX(a.to.x), y2 = toY(a.to.y);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return null;
    const ux = dx / len, uy = dy / len;
    const ax = x2 - ux * 10, ay = y2 - uy * 10;
    const isShot = a.type === 'shot';
    const color = isShot ? '#ef4444' : '#eab308';
    return (
      <g key={`arr${i}`} opacity={0.8}>
        <line x1={x1} y1={y1} x2={ax} y2={ay}
          stroke={color} strokeWidth={2.5}
          strokeDasharray={isShot ? 'none' : '8,5'}
        />
        <polygon points={`${ax - uy * 5},${ay + ux * 5} ${x2},${y2} ${ax + uy * 5},${ay - ux * 5}`} fill={color} />
      </g>
    );
  });
}

function PlayerDots({ focusedRoles, rph, t, theme, reducedMotion }) {
  return POSITIONS.map(pos => {
    const p = rph.pos[pos];
    if (!hasPoint(p)) return null;
    const s = focusedRoles.has(pos);
    const ox = toX(p.x), oy = toY(p.y), r = s ? 14 : 10;
    const c = s ? t.sc : t.pc[pos];

    return (
      <g
        key={pos}
        data-team="us"
        data-role={pos}
        data-focused={s ? 'true' : 'false'}
      >
        {s && (
          <circle cx={ox} cy={oy} r={r + 5} fill="none" stroke={t.sc} strokeWidth={1.3} opacity={0.3}>
            {!reducedMotion && (
              <animate attributeName="r" values={`${r + 3};${r + 8};${r + 3}`} dur="2s" repeatCount="indefinite" />
            )}
          </circle>
        )}
        {p.u === 'sprint' && (
          <circle cx={ox} cy={oy} r={r + 2} fill="none" stroke={c} strokeWidth={0.7} opacity={0.35} strokeDasharray="3,3">
            {!reducedMotion && (
              <animate attributeName="r" values={`${r + 1};${r + 5};${r + 1}`} dur="1s" repeatCount="indefinite" />
            )}
          </circle>
        )}
        <MotionCircle
          cx={ox}
          cy={oy}
          initial={{ cx: ox, cy: oy }}
          animate={{ cx: ox, cy: oy }}
          transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }}
          r={r} fill={c} opacity={s ? 1 : 0.88}
          stroke={s ? (theme === 'dark' ? '#fff' : '#0a0e1a') : 'rgba(255,255,255,0.2)'}
          strokeWidth={s ? 2 : 1}
          style={{ filter: s ? `drop-shadow(0 0 6px ${t.sc})` : 'none' }}
        />
        <MotionText
          animate={{ x: ox, y: oy + 1 }}
          transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }}
          textAnchor="middle" dominantBaseline="central"
          fill={s ? t.dt : '#fff'} fontSize={s ? 9 : 8}
          fontWeight="bold" fontFamily="monospace"
        >{pos}</MotionText>
      </g>
    );
  });
}

function OpponentDots({ rph, t, theme }) {
  if (!rph.opp) return null;
  const neon = t.oc;
  const oppFill = theme === 'dark' ? '#c8d5e8' : '#dfe6f0';

  return rph.opp.map(o => {
    if (!hasPoint(o)) return null;
    const ox = toX(o.x), oy = toY(o.y);
    const label = o.l || o.label;

    return (
      <g
        key={o.id}
        data-team="opponent"
        data-player-id={o.id}
        style={{ filter: theme === 'dark' ? 'url(#ng)' : 'none' }}
      >
        <MotionCircle cx={ox} cy={oy} initial={{ cx: ox, cy: oy }} animate={{ cx: ox, cy: oy }} transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }} r={10} fill={oppFill} opacity={0.92} />
        <MotionCircle cx={ox} cy={oy} initial={{ cx: ox, cy: oy }} animate={{ cx: ox, cy: oy }} transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }} r={10} fill="none" stroke={neon} strokeWidth={2} opacity={theme === 'dark' ? 0.95 : 0.78} />
        <MotionCircle cx={ox} cy={oy} initial={{ cx: ox, cy: oy }} animate={{ cx: ox, cy: oy }} transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }} r={9} fill={neon} opacity={0.1} />
        <MotionText
          animate={{ x: ox, y: oy + 1 }}
          transition={{ duration: PLAYER_ANIM_S, ease: 'easeOut' }}
          textAnchor="middle" dominantBaseline="central"
          fill={neon} fontSize={8} fontWeight="bold" fontFamily="monospace" opacity={0.95}
        >{label}</MotionText>
      </g>
    );
  });
}

function BallIndicator({ focusedRoles, rph, mode, reducedMotion }) {
  if (!hasPoint(rph.ball)) return null;
  let bx = toX(rph.ball.x), by = toY(rph.ball.y);

  const carrier = POSITIONS.find(pos => rph.pos[pos]?.ball);
  if (carrier) {
    const cp = rph.pos[carrier];
    const cpx = toX(cp.x), cpy = toY(cp.y);
    const r = focusedRoles.has(carrier) ? 14 : 10;
    let dx = bx - cpx, dy = by - cpy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) { dx = 1; dy = -1; }
    const ux = dx / (dist || 1), uy = dy / (dist || 1);
    bx = cpx + ux * (r + 4);
    by = cpy + uy * (r + 4);
  }

  if (mode === 'tactics' && !carrier) {
    const oppCarrier = rph.opp?.find(o => o.hasBall);
    if (oppCarrier) {
      const cx = toX(oppCarrier.x), cy = toY(oppCarrier.y);
      let dx = bx - cx, dy = by - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) { dx = 1; dy = -1; }
      const ux = dx / (dist || 1), uy = dy / (dist || 1);
      bx = cx + ux * 14;
      by = cy + uy * 14;
    }
  }

  const arrows = mode === 'tactics' ? rph.arrows : null;
  const hasArrow = arrows && arrows.length > 0;

  let animX, animY, transition;

  if (rph.ballPath && rph.ballPath.length >= 2) {
    const xk = rph.ballPath.map(wp => toX(wp.x));
    const yk = rph.ballPath.map(wp => toY(wp.y));
    xk[xk.length - 1] = bx;
    yk[yk.length - 1] = by;
    const segCount = xk.length - 1;
    const times = xk.map((_, i) => i / segCount);
    animX = xk; animY = yk;
    transition = { duration: Math.max(PLAYER_ANIM_S, 0.15 * segCount), ease: 'linear', times };
  } else if (hasArrow) {
    const xk = [toX(arrows[0].from.x)];
    const yk = [toY(arrows[0].from.y)];
    for (let i = 0; i < arrows.length - 1; i++) {
      xk.push(toX(arrows[i].to.x));
      yk.push(toY(arrows[i].to.y));
    }
    xk.push(bx); yk.push(by);
    animX = xk; animY = yk;
    const times = xk.map((_, i) => i / (xk.length - 1));
    transition = { duration: Math.max(PLAYER_ANIM_S, 0.5 * arrows.length), ease: 'easeOut', times };
  } else {
    animX = bx; animY = by;
    transition = { duration: PLAYER_ANIM_S, ease: 'easeOut' };
  }

  return (
    <MotionG animate={{ x: animX, y: animY }} transition={transition}>
      <circle r={7} fill={BALL_COLOR} opacity={0.2}>
        {!reducedMotion && (
          <animate attributeName="r" values="7;11;7" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>
      <circle r={6} fill={BALL_COLOR} />
      <circle r={6} fill="none" stroke="#fff" strokeWidth={1} opacity={0.5} />
    </MotionG>
  );
}

export default function RinkSVG({
  mode,
  phaseData,
  prevPhaseData,
  coverage,
  roleFocusMode = null,
  selectedPosition = null,
  showOpponents = true,
  ariaLabel = 'Ball hockey rink',
}) {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const appCtx = useApp();
  const reducedMotion = useReducedMotion();

  const isTactics = mode === 'tactics';
  const isScene = mode === 'scene';
  const isDark = theme === 'dark';

  let rph, rprev, focusedRoles, showOpp;

  if (isTactics || isScene) {
    if (!phaseData) return null;
    rph = phaseData;
    rprev = prevPhaseData || null;
    focusedRoles = isScene
      ? new Set(roleFocusMode ? rolesForRoleLens(roleFocusMode) : selectedPosition ? [selectedPosition] : [])
      : new Set();
    showOpp = isScene ? showOpponents : true;
  } else {
    const {
      currentPhase,
      currentReplayPhases,
      isMirrored,
      previousPositions,
      roleFocusMode,
      showOpponents,
    } = appCtx;
    const ph = currentReplayPhases[currentPhase];
    if (!ph) return null;
    rph = isMirrored ? mirrorPhase(ph) : ph;
    rprev = isMirrored && previousPositions
      ? (() => {
          const fl = p => ({ ...p, x: 100 - p.x });
          return { LW: fl(previousPositions.RW), C: fl(previousPositions.C), RW: fl(previousPositions.LW), LD: fl(previousPositions.RD), RD: fl(previousPositions.LD), G: fl(previousPositions.G) };
        })()
      : previousPositions;
    focusedRoles = new Set(rolesForRoleLens(roleFocusMode));
    showOpp = showOpponents;
  }

  const glY1 = toY(6), glY2 = toY(94), cx = W / 2;

  // Theme-aware rink surface colors
  const rkFrom   = isDark ? '#17191d' : '#e1e4e7';
  const rkTo     = isDark ? '#22262b' : '#f0f1f2';
  const rkBorder = isDark ? '#3a4047' : '#bac1c8';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ maxWidth: 380 }}
      role="img"
      aria-label={ariaLabel}
      aria-description="Home players use position labels and opponents use numbered labels, so team and focus do not rely on color alone."
      data-renderer={isScene ? 'play-scene-2d' : undefined}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-ball-segment={rph.sceneFrame?.ball?.segmentType
        ?? (rph.faceoffState
          ? (rph.faceoffState === 'draw' ? 'faceoff' : rph.ballOwner ? 'carry' : 'loose')
          : undefined)}
      data-ball-owner={rph.sceneFrame?.ball?.ownerId
        ?? (rph.faceoffState ? (rph.ballOwner ?? 'none') : undefined)}
    >
      <defs>
        <radialGradient id="rg">
          <stop offset="0%"   stopColor={rkFrom} />
          <stop offset="100%" stopColor={rkTo} />
        </radialGradient>
        <filter id="ng">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Rink surface */}
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={52} fill="url(#rg)" stroke={rkBorder} strokeWidth={2.5} />

      <RinkMarkings t={t} glY1={glY1} glY2={glY2} cx={cx} isDark={isDark} />

      {/* Team watermark */}
      <image
        href="/goonsquad.png"
        x={W / 2 - 153}
        y={H * 0.32}
        width={306}
        height={H * 0.34}
        opacity={isDark ? 0.07 : 0.12}
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: 'none' }}
      />

      {isTactics && <CoverageLines coverage={coverage} rph={rph} />}
      {isTactics && <TacticalArrows arrows={rph.arrows} />}
      <MovementTrails focusedRoles={focusedRoles} prev={rprev} rph={rph} t={t} />
      {!isTactics && <PassingLanes rph={rph} />}
      <PlayerDots focusedRoles={focusedRoles} rph={rph} t={t} theme={theme} reducedMotion={reducedMotion} />
      {showOpp && <OpponentDots rph={rph} t={t} theme={theme} />}
      <BallIndicator focusedRoles={focusedRoles} rph={rph} mode={mode} reducedMotion={reducedMotion} />
    </svg>
  );
}
