export function mirrorPhase(ph) {
  if (!ph) return ph;
  const mp = { ...ph };
  const p = ph.pos;
  const fl = pos => ({ ...pos, x: 100 - pos.x });

  mp.pos = {
    LW: fl(p.RW),
    C: fl(p.C),
    RW: fl(p.LW),
    LD: fl(p.RD),
    RD: fl(p.LD),
    G: fl(p.G),
  };

  if (ph.opp) mp.opp = ph.opp.map(o => ({ ...o, x: 100 - o.x }));
  if (ph.ball) mp.ball = { x: 100 - ph.ball.x, y: ph.ball.y };
  if (ph.ballPath) mp.ballPath = ph.ballPath.map(wp => ({ x: 100 - wp.x, y: wp.y }));

  const sw = p => ({ LW: 'RW', RW: 'LW', LD: 'RD', RD: 'LD' }[p] || p);
  if (ph.lanes) mp.lanes = ph.lanes.map(l => ({ ...l, f: sw(l.f), t: sw(l.t) }));

  return mp;
}
