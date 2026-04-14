// fix_batch1.mjs — non-faceoff batch 1: btn, brk, rev, whl, nfd, dzr
// 26 overlap issues, all spatial — prefer moving opp players over our players

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

// ── btn Ph0 ───────────────────────────────────────────────────────────────────
// LD(30,70) ↔ F2(25,76) d=7.8 | RD(70,70) ↔ F3(70,76) d=6.0
{
  const p = ph('btn', 0);
  opp(p, 'o4').x = 21; opp(p, 'o4').y = 76;  // F2 → {21,76}  LD dist=10.8
  opp(p, 'o5').x = 72; opp(p, 'o5').y = 80;  // F3 → {72,80}  RD dist=10.2
  console.log('✓ btn Ph0: F2/F3 spread');
}

// ── btn Ph1 ───────────────────────────────────────────────────────────────────
// LW(28,84)↔F2(28,78)=6.0 | C(60,95)↔D2(58,90)=5.4 | LD(32,72)↔F2=7.2 | RD(66,72)↔F3(68,78)=6.3
{
  const p = ph('btn', 1);
  opp(p, 'o2').x = 50; opp(p, 'o2').y = 90;  // D2 → {50,90}  C dist=11.2, F1 dist=8.0
  opp(p, 'o4').x = 22; opp(p, 'o4').y = 78;  // F2 → {22,78}  LW dist=8.5, LD dist=11.7
  opp(p, 'o5').x = 72; opp(p, 'o5').y = 80;  // F3 → {72,80}  RD dist=10.0
  console.log('✓ btn Ph1: D2/F2/F3 spread');
}

// ── btn Ph2 ───────────────────────────────────────────────────────────────────
// C(65,92)↔RW(62,87)=5.8 | C↔D2(60,88)=6.4 | RW↔D2=2.2 | LW(32,84)↔F2(30,78)=6.3
// LD(35,72)↔F2=7.8 | RD(65,72)↔F3(66,78)=6.1
{
  const p = ph('btn', 2);
  p.pos.RW = { ...p.pos.RW, x: 68, y: 82 };  // RW → {68,82}  C dist=10.4
  opp(p, 'o2').x = 60; opp(p, 'o2').y = 82;  // D2 → {60,82}  C dist=11.2, RW dist=8.0
  opp(p, 'o4').x = 24; opp(p, 'o4').y = 76;  // F2 → {24,76}  LW dist=11.3, LD dist=11.7
  opp(p, 'o5').x = 75; opp(p, 'o5').y = 78;  // F3 → {75,78}  RD dist=11.7
  console.log('✓ btn Ph2: RW/D2/F2/F3 spread');
}

// ── brk Ph0 ───────────────────────────────────────────────────────────────────
// LW(12,34) ↔ F2(15,30) d=5.0
{
  const p = ph('brk', 0);
  p.pos.LW = { ...p.pos.LW, x: 8, y: 35 };   // LW → {8,35}  F2 dist=8.6
  console.log('✓ brk Ph0: LW pulled to boards');
}

// ── rev Ph0 ───────────────────────────────────────────────────────────────────
// LW(12,34) ↔ F2(10,32) d=2.8  CRITICAL
{
  const p = ph('rev', 0);
  p.pos.LW = { ...p.pos.LW, x: 8, y: 40 };   // LW → {8,40}  F2 dist=8.2
  console.log('✓ rev Ph0: LW pulled to boards');
}

// ── rev Ph1 ───────────────────────────────────────────────────────────────────
// C(62,28) ↔ F3(55,30) d=7.3
{
  const p = ph('rev', 1);
  opp(p, 'o3').x = 55; opp(p, 'o3').y = 36;  // F3 → {55,36}  C dist=10.6, LW(45,40) dist=10.8
  console.log('✓ rev Ph1: F3 moved back');
}

// ── whl Ph0 ───────────────────────────────────────────────────────────────────
// LW(14,32)↔F2(18,28)=5.7 | C(50,26)↔F3(55,24)=5.4
{
  const p = ph('whl', 0);
  opp(p, 'o2').x = 24; opp(p, 'o2').y = 24;  // F2 → {24,24}  LW dist=12.8, F1 dist=8.1
  opp(p, 'o3').x = 60; opp(p, 'o3').y = 22;  // F3 → {60,22}  C dist=10.8
  console.log('✓ whl Ph0: F2/F3 spread');
}

// ── nfd Ph0 ───────────────────────────────────────────────────────────────────
// RD(55,11) ↔ F2(50,14) d=5.8
{
  const p = ph('nfd', 0);
  opp(p, 'o2').x = 60; opp(p, 'o2').y = 18;  // F2 → {60,18}  RD dist=8.6
  console.log('✓ nfd Ph0: F2 moved right');
}

// ── nfd Ph1 ───────────────────────────────────────────────────────────────────
// C(48,18)↔F2(52,14)=5.7 | LD(35,4)↔F1(42,2)=7.3
{
  const p = ph('nfd', 1);
  opp(p, 'o1').x = 28; opp(p, 'o1').y = 10;  // F1 → {28,10}  LD dist=9.2
  opp(p, 'o2').x = 62; opp(p, 'o2').y = 12;  // F2 → {62,12}  C dist=15.2, RD dist=8.9
  console.log('✓ nfd Ph1: F1/F2 spread');
}

// ── dzr Ph0 ───────────────────────────────────────────────────────────────────
// LW(25,44)↔F2(28,50)=6.7 | RW(75,44)↔F3(72,50)=6.7
// F2↔D1(35,48)=7.3 | F3↔D2(65,48)=7.3
{
  const p = ph('dzr', 0);
  opp(p, 'o2').x = 24; opp(p, 'o2').y = 56;  // F2 → {24,56}  LW dist=12.0, D1 dist=13.6
  opp(p, 'o3').x = 76; opp(p, 'o3').y = 56;  // F3 → {76,56}  RW dist=12.0, D2 dist=13.6
  console.log('✓ dzr Ph0: F2/F3 pushed forward');
}

// ── dzr Ph1 ───────────────────────────────────────────────────────────────────
// LW(20,28)↔F2(22,35)=7.3 | RW(75,28)↔F3(78,35)=7.6
{
  const p = ph('dzr', 1);
  opp(p, 'o2').x = 18; opp(p, 'o2').y = 42;  // F2 → {18,42}  LW dist=14.1, D1 dist=14.0
  opp(p, 'o3').x = 82; opp(p, 'o3').y = 42;  // F3 → {82,42}  RW dist=15.7, D2 dist=14.0
  console.log('✓ dzr Ph1: F2/F3 pushed forward');
}

// ── VALIDATION ────────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (affected plays) ═══');
let issues = 0;
['btn','brk','rev','whl','nfd','dzr'].forEach(id => {
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

// ── SERIALIZE only affected plays ────────────────────────────────────────────
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
for (const id of ['btn','brk','rev','whl','nfd','dzr']) {
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
