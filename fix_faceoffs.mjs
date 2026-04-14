// fix_faceoffs.mjs — fix all faceoff plays
// Violations:
//   1. nzfc Ph1 WON: C carries ball after win — draw should go to LD
//   2. All Ph0 alignments: opp centers/wings at 6 units from ours (need 8+)
//   3. Post-draw overlaps in dzfl, dzfr, ozfl, ppfo, pkfo phases

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const rawSrc = readFileSync('./src/data/plays.js', 'utf8');
const code = rawSrc
  .replace(/^export const /mg, 'const ')
  .replace(/^export /mg, '');
const { PLAYS, GK } = new Function('require', code + '; return { PLAYS, GK };')(require);

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

const FACEOFF_IDS = ['dzfl', 'dzfr', 'nzfc', 'ozfl', 'ppfo', 'pkfo'];

function play(id) { return PLAYS.find(p => p.id === id); }
function ph(id, idx) { return play(id).phases[idx]; }

// ── 1. nzfc Ph1 WON: draw goes to LD, not C ───────────────────────────────
{
  const p = ph('nzfc', 1);
  p.pos.LD = { x: 38, y: 50, role: "Received the draw. Launch the rush.", u: "run", ball: true };
  p.pos.C  = { x: 50, y: 63, role: "Drive net hard.", u: "sprint" };
  p.ball   = { x: 38, y: 50 };
  p.lanes  = [{ f: "LD", t: "LW", ty: "primary" }, { f: "LD", t: "C", ty: "secondary" }];
  console.log('✓ nzfc Ph1: LD receives draw');
}

// ── 2. Alignment Phase 0: push opp facers back to 9-unit gap ──────────────
// D-zone: our y≈18, opp y≈24 (gap=6). Push opp faceoff line to y=28.
// O-zone: our y≈82, opp y≈76 (gap=6). Push opp faceoff line to y=73.
// NZ:     our y≈47, opp y≈53 (gap=6). Push opp faceoff line to y=57.

{
  const p = ph('dzfl', 0);
  p.opp.filter(o => o.y === 24).forEach(o => o.y = 28);
  // LD{22,12}↔LW{20,18}=7.3 — pull LD slightly further from LW
  p.pos.LD = { x: 18, y: 9, role: p.pos.LD.role, u: p.pos.LD.u };
  console.log('✓ dzfl Ph0: alignment gaps fixed');
}
{
  const p = ph('dzfr', 0);
  p.opp.filter(o => o.y === 24).forEach(o => o.y = 28);
  // RW{80,18}↔RD{78,12}=6.3 — nudge RD left
  p.pos.RD = { x: 74, y: 12, role: p.pos.RD.role, u: p.pos.RD.u };
  console.log('✓ dzfr Ph0: alignment + RW/RD gap fixed');
}
{
  const p = ph('nzfc', 0);
  p.opp.filter(o => o.y === 53 || o.y === 54).forEach(o => o.y = 57);
  console.log('✓ nzfc Ph0: alignment gaps fixed');
}
{
  const p = ph('ozfl', 0);
  p.opp.filter(o => o.y === 76).forEach(o => o.y = 73);
  console.log('✓ ozfl Ph0: alignment gaps fixed');
}
{
  const p = ph('ppfo', 0);
  p.opp.filter(o => o.y === 76).forEach(o => o.y = 73);
  console.log('✓ ppfo Ph0: alignment gaps fixed');
}
{
  const p = ph('pkfo', 0);
  p.opp.filter(o => o.y === 24).forEach(o => o.y = 28);
  p.pos.LD = { x: 18, y: 9, role: p.pos.LD.role, u: p.pos.LD.u };
  console.log('✓ pkfo Ph0: alignment + LD gap fixed');
}

// ── 3. Specific post-draw fixes ────────────────────────────────────────────

// dzfl Ph3: LD{24,21}↔ball carrier F2{26,22}=2.2 — move LD goal-side
{
  const p = ph('dzfl', 3);
  p.pos.LD = { x: 22, y: 14, role: p.pos.LD.role, u: p.pos.LD.u };
  console.log('✓ dzfl Ph3: LD moved goal-side of carrier');
}

// dzfr Ph1: C{74,24}↔F2{72,26}=2.8 — move C clear
{
  const p = ph('dzfr', 1);
  p.pos.C = { x: 65, y: 20, role: p.pos.C.role, u: p.pos.C.u };
  console.log('✓ dzfr Ph1: C moved clear');
}

// dzfr Ph3: RD{76,21}↔F2{74,22}=2.2; C{68,18}↔F1{64,24}=7.2
{
  const p = ph('dzfr', 3);
  p.pos.RD = { x: 76, y: 13, role: p.pos.RD.role, u: p.pos.RD.u };
  p.pos.C  = { x: 60, y: 14, role: p.pos.C.role,  u: p.pos.C.u  };
  console.log('✓ dzfr Ph3: RD and C moved clear');
}

// pkfo Ph1: C{40,30}↔F3{38,28}=2.8 — move C up-zone
{
  const p = ph('pkfo', 1);
  p.pos.C = { x: 42, y: 38, role: p.pos.C.role, u: p.pos.C.u };
  console.log('✓ pkfo Ph1: C moved clear of F3');
}

// pkfo Ph2: C{38,24}↔F3{38,26}=2.0; then LD↔C near — fix both
{
  const p = ph('pkfo', 2);
  p.pos.C  = { x: 38, y: 18, role: p.pos.C.role,  u: p.pos.C.u  };
  p.pos.LD = { x: 30, y: 10, role: p.pos.LD.role, u: p.pos.LD.u };
  console.log('✓ pkfo Ph2: C and LD moved clear');
}

// nzfc Ph2 LOST: LW{30,46}↔LD{35,40}=7.8 and RW{70,46}↔RD{65,40}=7.8
// Rounding prevents deconflict convergence — fix explicitly
{
  const p = ph('nzfc', 2);
  p.pos.LD = { x: 38, y: 38, role: p.pos.LD.role, u: p.pos.LD.u };
  p.pos.RD = { x: 62, y: 38, role: p.pos.RD.role, u: p.pos.RD.u };
  console.log('✓ nzfc Ph2: LD and RD moved back');
}

// ── 4. AUTO-DECONFLICT on all faceoff plays ────────────────────────────────
// After targeted fixes, push remaining overlapping pairs apart.
// Prefer moving opp players; never move goalies.

function deconflict(p) {
  const MIN = 8.0;
  // Build mutable lists — separate our/opp
  const ourKeys = Object.keys(p.pos).filter(k => k !== 'G' && p.pos[k]);
  const ours = ourKeys.map(k => ({ src: 'our', key: k, x: p.pos[k].x, y: p.pos[k].y }));
  const opps = p.opp
    .filter(o => !o.isGoalie && o.id !== 'og' && o.l !== 'G')
    .map(o => ({ src: 'opp', id: o.id, x: o.x, y: o.y }));

  const all = [...ours, ...opps];

  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const d = dist(a, b);
        if (d >= MIN) continue;
        moved = true;
        const push = (MIN - d) / 2 + 0.5;
        let dx = b.x - a.x, dy = b.y - a.y;
        const mag = Math.max(d, 0.1);
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) { dx = 1; dy = 0; }

        // Prefer moving opp; if both same type, split
        if (a.src === 'our' && b.src === 'opp') {
          b.x = Math.round(b.x + (dx / mag) * push * 2);
          b.y = Math.round(b.y + (dy / mag) * push * 2);
        } else if (a.src === 'opp' && b.src === 'our') {
          a.x = Math.round(a.x - (dx / mag) * push * 2);
          a.y = Math.round(a.y - (dy / mag) * push * 2);
        } else {
          // Both same — split equally
          a.x = Math.round(a.x - (dx / mag) * push);
          a.y = Math.round(a.y - (dy / mag) * push);
          b.x = Math.round(b.x + (dx / mag) * push);
          b.y = Math.round(b.y + (dy / mag) * push);
        }
        // Clamp
        for (const pt of [a, b]) {
          pt.x = Math.max(2, Math.min(98, pt.x));
          pt.y = Math.max(2, Math.min(98, pt.y));
        }
      }
    }
    if (!moved) break;
  }

  // Write back
  for (const o of ours) { p.pos[o.key].x = o.x; p.pos[o.key].y = o.y; }
  for (const o of opps) {
    const orig = p.opp.find(x => x.id === o.id);
    if (orig) { orig.x = o.x; orig.y = o.y; }
  }

  // Sync ball with carrier
  for (const k of ourKeys) {
    if (p.pos[k] && p.pos[k].ball) {
      p.ball = { x: p.pos[k].x, y: p.pos[k].y };
    }
  }
}

for (const id of FACEOFF_IDS) {
  play(id).phases.forEach((p, i) => deconflict(p));
}
console.log('✓ Auto-deconflict complete');

// ── VALIDATION ────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (faceoff plays) ═══');
let issues = 0;
FACEOFF_IDS.forEach(id => {
  play(id).phases.forEach((p, pi) => {
    const ours = Object.entries(p.pos)
      .filter(([k, v]) => k !== 'G' && v)
      .map(([k, v]) => ({ label: `our.${k}`, x: v.x, y: v.y }));
    const opps = (p.opp || [])
      .filter(o => !o.isGoalie && o.l !== 'G' && o.id !== 'og')
      .map(o => ({ label: `opp.${o.id}(${o.l})`, x: o.x, y: o.y }));
    const all = [...ours, ...opps];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const d = dist(all[i], all[j]);
        if (d < 8) {
          issues++;
          console.log(`  [${id}] Ph${pi}: ${all[i].label}(${all[i].x},${all[i].y}) ↔ ${all[j].label}(${all[j].x},${all[j].y}) dist=${d.toFixed(1)}`);
        }
      }
    }
  });
});

console.log('\n═══ FACEOFF VIOLATIONS ═══');
FACEOFF_IDS.forEach(id => {
  play(id).phases.forEach((p, pi) => {
    if (!p.t.includes('WON') && !p.t.includes('✅')) return;
    const cPos = p.pos.C;
    if (cPos && cPos.ball) {
      issues++;
      console.log(`  [${id}] Ph${pi} "${p.t}": C has ball:true`);
    }
    if (cPos) {
      const ballAtC = Math.abs(p.ball.x - cPos.x) < 2 && Math.abs(p.ball.y - cPos.y) < 2;
      if (ballAtC && !cPos.ball) {
        issues++;
        console.log(`  [${id}] Ph${pi} "${p.t}": ball at C's position (self-carry)`);
      }
    }
  });
});

if (issues > 0) {
  console.log(`\n✗ ${issues} issues remain — not writing.`);
  process.exit(1);
}
console.log('✓ All checks passed.');

// ── SERIALIZE ─────────────────────────────────────────────────────────────
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
  const oppArr  = `[${p.opp.map(oppStr).join(',')}]`;
  const lanesArr = `[${(p.lanes || []).map(laneStr).join(',')}]`;
  let s = `{id:${p.id},t:${JSON.stringify(p.t)},desc:${JSON.stringify(p.desc)},pos:${posStr(p.pos)},opp:${oppArr},ball:{x:${p.ball.x},y:${p.ball.y}},lanes:${lanesArr}`;
  if (p.ballPath && p.ballPath.length) {
    s += `,ballPath:[${p.ballPath.map(pt => `{x:${pt.x},y:${pt.y}}`).join(',')}]`;
  }
  return s + '}';
}

let out = rawSrc;

for (const id of FACEOFF_IDS) {
  const playData = play(id);
  const startMark = `{id:"${id}",`;
  const startIdx = out.indexOf(startMark);
  if (startIdx === -1) { console.error(`Cannot find play ${id}`); process.exit(1); }

  const phasesStart = out.indexOf('phases:[', startIdx);
  if (phasesStart === -1) { console.error(`No phases for ${id}`); process.exit(1); }

  // Walk balanced brackets to find end of phases array
  let depth = 0, i = phasesStart + 'phases:['.length - 1;
  for (; i < out.length; i++) {
    if (out[i] === '[' || out[i] === '{') depth++;
    if (out[i] === ']' || out[i] === '}') { depth--; if (depth === 0) break; }
  }
  const phasesEnd = i + 1;

  const newBlock = `phases:[\n${playData.phases.map(phaseStr).join(',\n')}\n]`;
  out = out.slice(0, phasesStart) + newBlock + out.slice(phasesEnd);
  console.log(`✓ Serialized ${id}`);
}

writeFileSync('./src/data/plays.js', out, 'utf8');
console.log('\n✓ plays.js written.');
