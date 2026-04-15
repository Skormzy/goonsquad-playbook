// fix_faceoffs_v2.mjs — Realistic faceoff Phase 0 formations
//
// Rules applied (verified against USA Hockey Rule 104 / NHL faceoff procedures):
//   - Only the two centers at the dot, facing each other across the dot
//   - Wingers on hash marks (x = dot_x ± 8 data units per SVG circle radius fcR=28)
//     and roughly level with the dot in y — NOT bunched behind their center
//   - Each team's wingers face each other across the dot (same x, separated ≥8 y-units)
//   - D-men behind their forwards toward their own net
//   - No player other than center inside the faceoff circle

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const rawSrc = readFileSync('./src/data/plays.js', 'utf8');
const code = rawSrc
  .replace(/^export const /mg, 'const ')
  .replace(/^export /mg, '');
const { PLAYS, GK } = new Function('require', code + '; return { PLAYS, GK };')(require);

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function play(id) { return PLAYS.find(p => p.id === id); }

// ── PHASE 0 REDESIGNS ─────────────────────────────────────────────────────────
// For each play, we replace Phase 0's pos, opp, and ball only.
// Phase 0 t/desc/lanes are preserved from existing data.
//
// Coordinate system: OUR net y≈6-8 (low), THEIR net y≈94 (high)
// Our blue line y≈36, their blue line y≈64
// Hash marks at dot_x ± 8 data units (circle radius = 8 in data coords)

// ── dzfl — D-Zone Faceoff Left — dot(28,21) ─────────────────────────────────
// Defending. Our C on low y side (toward our net). Opp C on high y side.
// Our LW at left hash (x=18-20, y≈21), Our RW at right hash (x=38-40, y≈21).
// Opp wings face ours at same x, 9 y-units higher.
// Our D behind C toward our net (y<19). Opp D near our blue line (y≈36).
play('dzfl').phases[0].pos = {
  LW: { x:18, y:21, role:"Left hash mark. Face their wing. Tie them up on the draw.", u:"hold" },
  C:  { x:28, y:19, role:"At the faceoff dot, our side. Win draw back to LD.", u:"hold" },
  RW: { x:38, y:21, role:"Right hash mark. Face their wing. Block on the draw.", u:"hold" },
  LD: { x:16, y:11, role:"Draw target, strong side behind C. Receive and move fast.", u:"hold" },
  RD: { x:48, y:16, role:"Between the circles. Weak-side coverage. Read and react.", u:"hold" },
  G:  GK,
};
play('dzfl').phases[0].opp = [
  { id:"o1", x:28, y:28, l:"F2" },   // opp center
  { id:"o2", x:18, y:30, l:"F1" },   // left hash, their side
  { id:"o3", x:38, y:30, l:"F3" },   // right hash, their side
  { id:"o4", x:26, y:36, l:"D1" },   // behind their forwards, near our blue line
  { id:"o5", x:50, y:36, l:"D2" },
];
play('dzfl').phases[0].ball = { x:28, y:21 };

// ── dzfr — D-Zone Faceoff Right — dot(72,21) ─────────────────────────────────
// Mirror of dzfl. Hash marks at x=64 and x=80.
// RD is draw target (right side). LD is between circles.
play('dzfr').phases[0].pos = {
  LW: { x:62, y:21, role:"Left hash mark. Slot side. Tie up their wing.", u:"hold" },
  C:  { x:72, y:19, role:"At the faceoff dot, our side. Win draw back to RD.", u:"hold" },
  RW: { x:82, y:21, role:"Right hash mark. Boards side. Tie up their wing.", u:"hold" },
  LD: { x:50, y:16, role:"Between circles. Weak-side coverage.", u:"hold" },
  RD: { x:84, y:11, role:"Draw target, strong side behind C. Receive and move fast.", u:"hold" },
  G:  GK,
};
play('dzfr').phases[0].opp = [
  { id:"o1", x:72, y:28, l:"F2" },
  { id:"o2", x:62, y:30, l:"F1" },
  { id:"o3", x:82, y:30, l:"F3" },
  { id:"o4", x:50, y:36, l:"D1" },
  { id:"o5", x:74, y:36, l:"D2" },  // moved inward from 78 — clear of boards-side F3
];
play('dzfr').phases[0].ball = { x:72, y:21 };

// ── nzfc — NZ Faceoff Center — dot(50,50) ────────────────────────────────────
// Center ice. Our C just below y=50 (our side). Opp C above y=50.
// Wings at y=50 (dot level). Opp wings at y=58 (their side, 8-unit gap).
// Our D at y≈44 (just behind center, safe from encroachment).
// Opp D at y=58 (also behind their forwards).
play('nzfc').phases[0].pos = {
  LW: { x:40, y:50, role:"Left hash at center. Win=attack. Lose=backcheck.", u:"hold" },
  C:  { x:50, y:48, role:"Just inside our side of center dot.", u:"hold" },
  RW: { x:60, y:50, role:"Right hash at center. Win=attack. Lose=backcheck.", u:"hold" },
  LD: { x:32, y:44, role:"Behind left wing. Safety valve on turnover.", u:"hold" },
  RD: { x:68, y:44, role:"Behind right wing. Safety valve on turnover.", u:"hold" },
  G:  GK,
};
play('nzfc').phases[0].opp = [
  { id:"o1", x:50, y:57, l:"F2" },
  { id:"o2", x:40, y:58, l:"F1" },
  { id:"o3", x:60, y:58, l:"F3" },
  { id:"o4", x:28, y:58, l:"D1" },
  { id:"o5", x:72, y:58, l:"D2" },
];
play('nzfc').phases[0].ball = { x:50, y:50 };

// ── ozfl — O-Zone Faceoff Left — dot(28,79) ──────────────────────────────────
// Attacking their net (y=94). Our C on HIGH y side (attack side, y=82).
// Opp C on LOW y side (defend side, y=73).
// Our wings at y=80 (just above dot, attacking side).
// Opp defending wings at y=71 (their side, 9-unit gap from ours).
// Our D at left/right point (y≈62-66), near their blue line.
// Opp D close to their own net (y≈86-88).
play('ozfl').phases[0].pos = {
  LW: { x:18, y:80, role:"Left hash, attack side. Battle for loose ball on the draw.", u:"hold" },
  C:  { x:28, y:82, role:"At the dot, attack side. Win draw back to LD.", u:"hold" },
  RW: { x:38, y:80, role:"Right hash, attack side. Screen and battle.", u:"hold" },
  LD: { x:22, y:62, role:"Left point. Primary draw target. Receive and SHOOT.", u:"hold" },
  RD: { x:64, y:66, role:"Right point. D-to-D option. Keep puck in zone.", u:"hold" },
  G:  GK,
};
play('ozfl').phases[0].opp = [
  { id:"o1", x:28, y:73, l:"F2" },
  { id:"o2", x:18, y:71, l:"F1" },
  { id:"o3", x:38, y:71, l:"F3" },
  { id:"o4", x:12, y:88, l:"D1" },
  { id:"o5", x:68, y:86, l:"D2" },
  { id:"og", x:50, y:96, l:"G" },
];
play('ozfl').phases[0].ball = { x:28, y:79 };

// ── ppfo — PP Faceoff O-Zone — dot(28,79) ────────────────────────────────────
// Same dot as ozfl. RW is in screener position (intentional — not at hash mark).
// PK team has only 4 skaters. PK1=center, PK2/3=wings, PK4=back defender.
play('ppfo').phases[0].pos = {
  LW: { x:18, y:80, role:"Left hash, attack side. Retrieve if draw is messy.", u:"hold" },
  C:  { x:28, y:82, role:"At the dot, attack side. Win draw back to LD.", u:"hold" },
  RW: { x:50, y:86, role:"Net-front screen. Stay put.", u:"hold" },
  LD: { x:22, y:62, role:"Left point. Primary draw target. Receive and SHOOT.", u:"hold" },
  RD: { x:64, y:66, role:"Right point. D-to-D option.", u:"hold" },
  G:  GK,
};
play('ppfo').phases[0].opp = [
  { id:"o1", x:28, y:73, l:"PK" },  // PK center at dot
  { id:"o2", x:18, y:71, l:"PK" },  // PK wing, left hash
  { id:"o3", x:38, y:71, l:"PK" },  // PK wing, right hash
  { id:"o4", x:62, y:86, l:"PK" },  // PK back defender
  { id:"og", x:50, y:96, l:"G" },
];
play('ppfo').phases[0].ball = { x:28, y:79 };

// ── pkfo — PK Faceoff D-Zone — dot(28,21) ────────────────────────────────────
// Short-handed (4v5). RW is in penalty box (kept at center ice as placeholder).
// Same positions as dzfl but RW absent. RD protects net.
play('pkfo').phases[0].pos = {
  LW: { x:18, y:21, role:"Left hash mark. Battle for the draw. Get ball OUT.", u:"hold" },
  C:  { x:28, y:19, role:"At the dot, our side. Win draw to LD.", u:"hold" },
  RW: { x:50, y:50, role:"Penalty box — off the ice.", u:"hold" },
  LD: { x:16, y:11, role:"Draw target. Receive and CLEAR immediately.", u:"hold" },
  RD: { x:48, y:9,  role:"Net-front protection. Nobody scores unchecked.", u:"hold" },
  G:  GK,
};
play('pkfo').phases[0].opp = [
  { id:"o1", x:28, y:28, l:"F2" },
  { id:"o2", x:18, y:30, l:"F1" },
  { id:"o3", x:38, y:30, l:"F3" },
  { id:"o4", x:26, y:36, l:"D1" },  // moved inward from 22 — clear of boards-side F1
  { id:"o5", x:50, y:36, l:"D2" },
];
play('pkfo').phases[0].ball = { x:28, y:21 };

// ── VALIDATION ────────────────────────────────────────────────────────────────
const FACEOFF_IDS = ['dzfl', 'dzfr', 'nzfc', 'ozfl', 'ppfo', 'pkfo'];

console.log('═══ OVERLAP CHECK — PHASE 0 FACEOFF ALIGNMENTS ═══');
let issues = 0;

for (const id of FACEOFF_IDS) {
  const ph0 = play(id).phases[0];
  const ours = Object.entries(ph0.pos)
    .filter(([k, v]) => k !== 'G' && v)
    .map(([k, v]) => ({ label: `our.${k}`, x: v.x, y: v.y }));
  const opps = ph0.opp
    .filter(o => o.l !== 'G' && !o.isGoalie && o.id !== 'og')
    .map(o => ({ label: `opp.${o.id}(${o.l})`, x: o.x, y: o.y }));
  const all = [...ours, ...opps];
  let playIssues = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const d = dist(all[i], all[j]);
      if (d < 8) {
        issues++; playIssues++;
        console.log(`  [${id}] Ph0: ${all[i].label}(${all[i].x},${all[i].y}) ↔ ${all[j].label}(${all[j].x},${all[j].y}) dist=${d.toFixed(2)}`);
      }
    }
  }
  if (!playIssues) console.log(`  ${id}: ✓ (${all.length} players)`);
}

if (issues > 0) {
  console.log(`\n✗ ${issues} overlaps in Phase 0 — not writing.`);
  process.exit(1);
}
console.log('\n✓ All Phase 0 alignments clean.\n');

// ── SERIALIZE HELPERS ─────────────────────────────────────────────────────────
function isStdGK(p) {
  return p.x === GK.x && p.y === GK.y && p.role === GK.role && p.u === GK.u
    && !p.ball && !p.key && !p.comm;
}
function pStr(p) {
  const parts = [`x:${p.x}`, `y:${p.y}`];
  if (p.role !== undefined) parts.push(`role:${JSON.stringify(p.role)}`);
  if (p.u)    parts.push(`u:${JSON.stringify(p.u)}`);
  if (p.ball) parts.push(`ball:true`);
  if (p.key)  parts.push(`key:${JSON.stringify(p.key)}`);
  if (p.comm) parts.push(`comm:${JSON.stringify(p.comm)}`);
  return `{${parts.join(',')}}`;
}
function posStr(pos) {
  return '{' + ['LW','C','RW','LD','RD','G']
    .filter(k => pos[k])
    .map(k => (k === 'G' && isStdGK(pos[k])) ? 'G:GK' : `${k}:${pStr(pos[k])}`)
    .join(',') + '}';
}
function oppStr(o) {
  const parts = [`id:${JSON.stringify(o.id)}`, `x:${o.x}`, `y:${o.y}`];
  if (o.l)        parts.push(`l:${JSON.stringify(o.l)}`);
  if (o.label)    parts.push(`label:${JSON.stringify(o.label)}`);
  if (o.hasBall)  parts.push(`hasBall:true`);
  if (o.isGoalie) parts.push(`isGoalie:true`);
  return `{${parts.join(',')}}`;
}
function laneStr(l) {
  return `{f:${JSON.stringify(l.f)},t:${JSON.stringify(l.t)},ty:${JSON.stringify(l.ty)}}`;
}
function phaseStr(p) {
  const oppArr   = `[${p.opp.map(oppStr).join(',')}]`;
  const lanesArr = `[${(p.lanes || []).map(laneStr).join(',')}]`;
  let s = `{id:${p.id},t:${JSON.stringify(p.t)},desc:${JSON.stringify(p.desc)},pos:${posStr(p.pos)},opp:${oppArr},ball:{x:${p.ball.x},y:${p.ball.y}},lanes:${lanesArr}`;
  if (p.ballPath && p.ballPath.length)
    s += `,ballPath:[${p.ballPath.map(pt => `{x:${pt.x},y:${pt.y}}`).join(',')}]`;
  return s + '}';
}

// ── WRITE ─────────────────────────────────────────────────────────────────────
let out = rawSrc;
for (const id of FACEOFF_IDS) {
  const playData = play(id);
  const startIdx = out.indexOf(`{id:"${id}",`);
  const phasesStart = out.indexOf('phases:[', startIdx);
  let depth = 0, i = phasesStart + 'phases:['.length - 1;
  for (; i < out.length; i++) {
    if (out[i] === '[' || out[i] === '{') depth++;
    if (out[i] === ']' || out[i] === '}') { depth--; if (depth === 0) break; }
  }
  out = out.slice(0, phasesStart)
    + `phases:[\n${playData.phases.map(phaseStr).join(',\n')}\n]`
    + out.slice(i + 1);
  console.log(`✓ Serialized ${id}`);
}
writeFileSync('./src/data/plays.js', out, 'utf8');
console.log('\n✓ plays.js written.');
