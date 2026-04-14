// fix_adversarial.mjs — address 4 adversarial review findings from faceoff commit
// 1. dzfr Ph1 WON: C role says "Box out" but C is now 13 units away — fix position
// 2. nzfc Ph1 WON: desc still says "Drive into zone" — update to match LD draw routing
// 3. pkfo Ph2 LOST: box shape broken — move opp F3 instead, restore C and LD to box positions
// 4. dzfr Ph3 LOST: C dropped key:"SLOT first. Ball second." — restore it

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
function ph(id, i) { return play(id).phases[i]; }

// ── Fix 1: dzfr Ph1 WON — reposition C to actually box out their center ────
// Their center (F2) is at {72,26}. C should be between F2 and the ball (RD at {78,13}).
// C at {71,18}: dist to F2{72,26}=8.06 ✓, dist to RD{78,13}=9.6 ✓ — proper box-out lane
{
  const p = ph('dzfr', 1);
  p.pos.C = { x: 71, y: 18, role: "Box out their center. Stay between them and the ball.", u: "run" };
  console.log('✓ dzfr Ph1: C repositioned for actual box-out');
}

// ── Fix 2: nzfc Ph1 WON — update desc to match LD draw routing ────────────
{
  const p = ph('nzfc', 1);
  p.desc = "C wins to LD. LD launches the rush. Wings explode wide.";
  console.log('✓ nzfc Ph1: desc updated to reflect LD draw routing');
}

// ── Fix 3: pkfo Ph2 LOST — move F3 instead of breaking the box ────────────
// Canonical box: LW{58,24} top-right, C{38,24} top-left, LD{38,12} bottom-left, RD{58,10} bottom-right
// Opp F3 was at {38,26} — 2 units from C{38,24}. Solution: move F3 to {28,26} (clear of C).
{
  const p = ph('pkfo', 2);
  const f3 = p.opp.find(o => o.id === 'o3');
  // F3 at {52,18}: right half-wall — clear of C{38,24} (15 units) and F2{28,22} (24 units)
  if (f3) { f3.x = 52; f3.y = 18; }

  // Restore box positions (C and LD were moved in previous fix to dodge F3)
  p.pos.C  = { x: 38, y: 24, role: p.pos.C.role,  u: p.pos.C.u,  key: "2 seconds. Go." };
  p.pos.LD = { x: 38, y: 12, role: p.pos.LD.role, u: p.pos.LD.u };
  console.log('✓ pkfo Ph2: F3 moved, box shape restored');
}

// ── Fix 4: dzfr Ph3 LOST — restore dropped key on C ──────────────────────
{
  const p = ph('dzfr', 3);
  p.pos.C = { ...p.pos.C, key: "SLOT first. Ball second." };
  console.log('✓ dzfr Ph3: C key restored');
}

// ── VALIDATION ────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (affected plays) ═══');
let issues = 0;
['dzfr','nzfc','pkfo'].forEach(id => {
  play(id).phases.forEach((p, pi) => {
    const ours = Object.entries(p.pos)
      .filter(([k, v]) => k !== 'G' && v)
      .map(([k, v]) => ({ label: `our.${k}`, x: v.x, y: v.y }));
    const opps = (p.opp || [])
      .filter(o => !o.isGoalie && o.l !== 'G' && o.id !== 'og')
      .map(o => ({ label: `opp.${o.id}(${o.l})`, x: o.x, y: o.y }));
    [...ours, ...opps].forEach((a, i, all) => {
      all.slice(i + 1).forEach(b => {
        const d = dist(a, b);
        if (d < 8) {
          issues++;
          console.log(`  [${id}] Ph${pi}: ${a.label}(${a.x},${a.y}) ↔ ${b.label}(${b.x},${b.y}) dist=${d.toFixed(1)}`);
        }
      });
    });
  });
});

if (issues > 0) {
  console.log(`\n✗ ${issues} overlaps — not writing.`);
  process.exit(1);
}
console.log('✓ No overlaps.');

// ── SERIALIZE only the 3 affected plays ───────────────────────────────────
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

let out = rawSrc;
for (const id of ['dzfr','nzfc','pkfo']) {
  const playData = play(id);
  const startIdx = out.indexOf(`{id:"${id}",`);
  const phasesStart = out.indexOf('phases:[', startIdx);
  let depth = 0, i = phasesStart + 'phases:['.length - 1;
  for (; i < out.length; i++) {
    if (out[i] === '[' || out[i] === '{') depth++;
    if (out[i] === ']' || out[i] === '}') { depth--; if (depth === 0) break; }
  }
  const phasesEnd = i + 1;
  out = out.slice(0, phasesStart)
    + `phases:[\n${playData.phases.map(phaseStr).join(',\n')}\n]`
    + out.slice(phasesEnd);
  console.log(`✓ Serialized ${id}`);
}

writeFileSync('./src/data/plays.js', out, 'utf8');
console.log('\n✓ plays.js written.');
