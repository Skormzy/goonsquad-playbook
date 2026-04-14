// fix_batch2.mjs — pomr, lcs, trap, nzr, zent, lcl, pts, ppum
// 32 overlap issues. Strategy: prefer moving opp players; move our players only when opp
// position is tactically load-bearing (ball carrier, defender in correct zone, etc.)

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
function opp(phase, id) { return phase.opp.find(o => o.id === id); }

// ── pomr Ph0 ──────────────────────────────────────────────────────────────────
// LW(15,85) ↔ F2(20,80) d=7.1
{
  const p = ph('pomr', 0);
  opp(p, 'o4').x = 10; opp(p, 'o4').y = 78;  // F2 → {10,78}  LW dist=8.6
  console.log('✓ pomr Ph0');
}

// ── pomr Ph1 ──────────────────────────────────────────────────────────────────
// LW(18,82)↔D1(22,80)=4.5 | LW↔F2(18,78)=4.0 | LD(18,72)↔F2=6.0 | D1↔F2=4.5
// Move LW to boards; spread D1 and F2 so the board battle is readable
{
  const p = ph('pomr', 1);
  p.pos.LW = { ...p.pos.LW, x: 10, y: 80 };  // LW → {10,80}  on boards
  opp(p, 'o1').x = 26; opp(p, 'o1').y = 82;  // D1 → {26,82}  LW dist=16.1
  opp(p, 'o4').x = 16; opp(p, 'o4').y = 86;  // F2 → {16,86}  LW dist=8.5, LD dist=14.1
  console.log('✓ pomr Ph1');
}

// ── pomr Ph2 ──────────────────────────────────────────────────────────────────
// LW(28,70)↔F2(28,68)=2.0 | C(50,68)↔F1(50,72)=4.0 | RW(62,56)↔RD(58,50)=7.2
// Turnover phase — opponents breaking. C drops back; RD drops deeper.
{
  const p = ph('pomr', 2);
  p.pos.C  = { ...p.pos.C,  x: 50, y: 62 };  // C  → {50,62}  F1(50,72) dist=10
  p.pos.RD = { ...p.pos.RD, x: 62, y: 46 };  // RD → {62,46}  RW(62,56) dist=10
  opp(p, 'o2').x = 20; opp(p, 'o2').y = 66;  // F2 → {20,66}  LW(28,70) dist=8.9
  console.log('✓ pomr Ph2');
}

// ── pomr Ph3 ──────────────────────────────────────────────────────────────────
// RD(55,70) ↔ F1(50,68) d=5.4 — F1 has ball; move RD instead
{
  const p = ph('pomr', 3);
  p.pos.RD = { ...p.pos.RD, x: 58, y: 74 };  // RD → {58,74}  F1(50,68) dist=10, D2(65,78) dist=8.1
  console.log('✓ pomr Ph3');
}

// ── lcs Ph0 ───────────────────────────────────────────────────────────────────
// C(38,80) ↔ F1(45,80) d=7.0
{
  const p = ph('lcs', 0);
  opp(p, 'o3').x = 50; opp(p, 'o3').y = 82;  // F1 → {50,82}  C dist=12.2
  console.log('✓ lcs Ph0');
}

// ── lcs Ph1 ───────────────────────────────────────────────────────────────────
// LW(14,34) ↔ F2(18,30) d=5.7
{
  const p = ph('lcs', 1);
  p.pos.LW = { ...p.pos.LW, x: 8, y: 36 };   // LW → {8,36}  F2(18,30) dist=11.7
  console.log('✓ lcs Ph1');
}

// ── lcs Ph2 ───────────────────────────────────────────────────────────────────
// LW(10,38) ↔ F2(15,32) d=7.8
{
  const p = ph('lcs', 2);
  p.pos.LW = { ...p.pos.LW, x: 6, y: 40 };   // LW → {6,40}  F2(15,32) dist=12.0
  console.log('✓ lcs Ph2');
}

// ── trap Ph1 ──────────────────────────────────────────────────────────────────
// LW(18,55) ↔ F1(15,62) d=7.6
{
  const p = ph('trap', 1);
  opp(p, 'o1').x = 10; opp(p, 'o1').y = 64;  // F1 → {10,64}  LW(18,55) dist=12.0
  console.log('✓ trap Ph1');
}

// ── nzr Ph1 ───────────────────────────────────────────────────────────────────
// opp F1(35,66) ↔ opp D1(35,72) d=6.0  (opp-opp overlap)
{
  const p = ph('nzr', 1);
  opp(p, 'o4').x = 28; opp(p, 'o4').y = 74;  // D1 → {28,74}  F1(35,66) dist=10.6
  console.log('✓ nzr Ph1');
}

// ── zent Ph1 ──────────────────────────────────────────────────────────────────
// C(45,72)↔F1(48,78)=6.7 | LD(28,68)↔D1(28,72)=4.0
// D1 backs up along boards (x=12,y=82) — "D Backing Up" narrative
{
  const p = ph('zent', 1);
  opp(p, 'o3').x = 52; opp(p, 'o3').y = 82;  // F1 → {52,82}  C dist=12.2
  opp(p, 'o1').x = 12; opp(p, 'o1').y = 82;  // D1 → {12,82}  LW(12,74) dist=8.0, LD(28,68) dist=21.3
  console.log('✓ zent Ph1');
}

// ── lcl Ph0 ───────────────────────────────────────────────────────────────────
// LW(12,88)↔D1(18,84)=7.2 | C(24,82)↔D1=6.3 | RW(55,86)↔D2(55,82)=4.0 | RD(60,68)↔F2(58,74)=6.3
{
  const p = ph('lcl', 0);
  opp(p, 'o1').x = 32; opp(p, 'o1').y = 86;  // D1 → {32,86}  C dist=8.9, LW dist=20.1
  opp(p, 'o2').x = 65; opp(p, 'o2').y = 80;  // D2 → {65,80}  RW dist=11.7
  opp(p, 'o4').x = 52; opp(p, 'o4').y = 76;  // F2 → {52,76}  RD dist=11.3, D2 dist=13.6
  console.log('✓ lcl Ph0');
}

// ── lcl Ph1 ───────────────────────────────────────────────────────────────────
// C(22,82)↔D1(22,80)=2.0 | RW(55,87)↔D2(58,82)=5.8 | RD(58,70)↔F2(55,72)=3.6 | F1(35,76)↔F3(40,70)=7.8
{
  const p = ph('lcl', 1);
  opp(p, 'o1').x = 28; opp(p, 'o1').y = 88;  // D1 → {28,88}  C(22,82) dist=8.5, behind net
  opp(p, 'o2').x = 64; opp(p, 'o2').y = 80;  // D2 → {64,80}  RW dist=11.4
  opp(p, 'o4').x = 50; opp(p, 'o4').y = 78;  // F2 → {50,78}  RD dist=11.3, D2 dist=14.1
  opp(p, 'o5').x = 44; opp(p, 'o5').y = 66;  // F3 → {44,66}  F1(35,76) dist=13.5
  console.log('✓ lcl Ph1');
}

// ── pts Ph0 ───────────────────────────────────────────────────────────────────
// LW(20,82)↔D1(24,78)=5.7 | C(40,83)↔F3(44,82)=4.1 | RW(55,86)↔D2(58,80)=6.7
{
  const p = ph('pts', 0);
  opp(p, 'o1').x = 18; opp(p, 'o1').y = 74;  // D1 → {18,74}  LW dist=8.2, F1(34,74) dist=16
  opp(p, 'o5').x = 44; opp(p, 'o5').y = 74;  // F3 → {44,74}  C dist=9.8, F2(52,72) dist=8.2
  opp(p, 'o2').x = 64; opp(p, 'o2').y = 78;  // D2 → {64,78}  RW dist=12.0
  console.log('✓ pts Ph0');
}

// ── pts Ph1 ───────────────────────────────────────────────────────────────────
// LW(25,86)↔D1(26,80)=6.1 | C(42,86)↔F3(45,84)=3.6 | RW(52,88)↔D2(56,82)=7.2 | LD(32,72)↔F1(36,76)=5.7
// Net-front scramble — spread crash and defenders
{
  const p = ph('pts', 1);
  p.pos.LW = { ...p.pos.LW, x: 20, y: 90 };  // LW → {20,90}  D1(26,80) dist=11.7
  opp(p, 'o2').x = 62; opp(p, 'o2').y = 82;  // D2 → {62,82}  RW dist=11.7
  opp(p, 'o3').x = 42; opp(p, 'o3').y = 78;  // F1 → {42,78}  LD dist=11.7, C dist=8.0
  opp(p, 'o5').x = 60; opp(p, 'o5').y = 90;  // F3 → {60,90}  C dist=18.4, RW dist=8.2
  console.log('✓ pts Ph1');
}

// ── ppum Ph1 ──────────────────────────────────────────────────────────────────
// RW(50,88) ↔ o4(PK)(55,86) d=5.4
{
  const p = ph('ppum', 1);
  opp(p, 'o4').x = 64; opp(p, 'o4').y = 86;  // o4 → {64,86}  RW dist=14.1, o2(55,78) dist=12.0
  console.log('✓ ppum Ph1');
}

// ── VALIDATION ────────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (all 8 plays) ═══');
let issues = 0;
['pomr','lcs','trap','nzr','zent','lcl','pts','ppum'].forEach(id => {
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

// ── SERIALIZE affected plays ──────────────────────────────────────────────────
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
for (const id of ['pomr','lcs','trap','nzr','zent','lcl','pts','ppum']) {
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
