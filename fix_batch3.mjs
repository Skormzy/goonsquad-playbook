// fix_batch3.mjs — fc12, fc21, bck, d21, d32, o21, o32
// 15 overlap issues across 7 plays

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

// ── fc12 Ph0: F2(50,80) atop C(50,82) ────────────────────────────────────────
// F2 is the middle-lane outlet; move them further up-ice to clear C
{
  const p = ph('fc12', 0);
  opp(p, 'o5').x = 50; opp(p, 'o5').y = 73;  // F2 → {50,73}  C(50,82) dist=9.0
  console.log('✓ fc12 Ph0: F2 moved up-ice to {50,73}');
}

// ── fc21 Ph0: F2(50,78) atop C(48,82) ────────────────────────────────────────
// Same fix — F2 outlet moves further from C
{
  const p = ph('fc21', 0);
  opp(p, 'o5').x = 50; opp(p, 'o5').y = 72;  // F2 → {50,72}  C(48,82) dist=10.2
  console.log('✓ fc21 Ph0: F2 moved up-ice to {50,72}');
}

// ── fc21 Ph1: LW↔F1 and D2↔F2 ────────────────────────────────────────────────
// LW(22,82)↔F1(20,78)=4.5 — LW just won the puck; F1 should retreat to boards
// D2(55,86)↔F2(50,80)=7.8 — D2 slides right to clear the gap
{
  const p = ph('fc21', 1);
  opp(p, 'o3').x = 12; opp(p, 'o3').y = 76;  // F1 → {12,76}  LW(22,82) dist=11.7
  opp(p, 'o2').x = 60; opp(p, 'o2').y = 86;  // D2 → {60,86}  F2(50,80) dist=11.7
  console.log('✓ fc21 Ph1: F1 retreats to boards {12,76}, D2 slides right {60,86}');
}

// ── bck Ph1: LW↔D1 and RW↔D2 ─────────────────────────────────────────────────
// LW(22,34)↔D1(24,40)=6.3 | RW(78,34)↔D2(76,40)=6.3
// Opp D are skating up the boards — push them further up-ice
{
  const p = ph('bck', 1);
  opp(p, 'o2').x = 18; opp(p, 'o2').y = 46;  // D1 → {18,46}  LW(22,34) dist=12.6
  opp(p, 'o3').x = 82; opp(p, 'o3').y = 46;  // D2 → {82,46}  RW(78,34) dist=12.6
  console.log('✓ bck Ph1: D1/D2 pushed up boards to {18,46}/{82,46}');
}

// ── d21 Ph0: F3(50,52) atop C(50,50) ─────────────────────────────────────────
// F3 is a neutral-zone trailing forward — push them further up-ice from C
{
  const p = ph('d21', 0);
  opp(p, 'o3').x = 50; opp(p, 'o3').y = 60;  // F3 → {50,60}  C(50,50) dist=10.0
  console.log('✓ d21 Ph0: F3 pushed up-ice to {50,60}');
}

// ── d21 Ph1: C↔F3 and LD↔F1 ──────────────────────────────────────────────────
// C(48,40)↔F3(50,42)=2.8 — F3 is the trailer; push them forward
// LD(42,18)↔F1(38,24)=7.2 — F1 is the carrier at {38,24}; shift LD right to hold lane
{
  const p = ph('d21', 1);
  opp(p, 'o3').x = 50; opp(p, 'o3').y = 48;  // F3 → {50,48}  C(48,40) dist=8.2
  p.pos.LD = { ...p.pos.LD, x: 48 };          // LD → {48,18}  F1(38,24) dist=11.7 — between F1 and F2
  console.log('✓ d21 Ph1: F3 to trailer spot {50,48}, LD shifted to lane {48,18}');
}

// ── d32 Ph0: F3(50,42) atop C(50,46) ─────────────────────────────────────────
// F3 is the middle attacker — push them forward from C
{
  const p = ph('d32', 0);
  opp(p, 'o3').x = 50; opp(p, 'o3').y = 36;  // F3 → {50,36}  C(50,46) dist=10.0
  console.log('✓ d32 Ph0: F3 pushed forward to {50,36}');
}

// ── d32 Ph1: C↔F3, LD↔F1, RD↔F2 ─────────────────────────────────────────────
// C(48,34)↔F3(48,30)=4.0 — F3 (trailer) pushed forward
// LD(36,16)↔F1(32,22)=7.2 — F1 is the carrier; LD shifts right to hold passing lane
// RD(56,14)↔F2(58,20)=6.3 — F2 attacking right side; move further out
{
  const p = ph('d32', 1);
  opp(p, 'o3').x = 48; opp(p, 'o3').y = 24;  // F3 → {48,24}  C(48,34) dist=10.0, LD(44,16) dist=8.9
  p.pos.LD = { ...p.pos.LD, x: 44 };          // LD → {44,16}  F1(32,22) dist=13.4
  opp(p, 'o2').x = 62; opp(p, 'o2').y = 24;  // F2 → {62,24}  RD(56,14) dist=11.7
  console.log('✓ d32 Ph1: F3 to {48,24}, LD to {44,16}, F2 to {62,24}');
}

// ── o21 Ph1: C↔F1 ─────────────────────────────────────────────────────────────
// C(55,72)↔F1(52,76)=5.0 — F1 shifts to right-side crease coverage
{
  const p = ph('o21', 1);
  opp(p, 'o2').x = 56; opp(p, 'o2').y = 82;  // F1 → {56,82}  C(55,72) dist=10.0, F3(65,80) dist=9.2
  console.log('✓ o21 Ph1: F1 to right crease {56,82}');
}

// ── o32 Ph1: C↔D1 ─────────────────────────────────────────────────────────────
// C(42,70)↔D1(38,70)=4.0 — D1 backs off as they're beaten in the rush
{
  const p = ph('o32', 1);
  opp(p, 'o1').x = 30; opp(p, 'o1').y = 70;  // D1 → {30,70}  C(42,70) dist=12.0, LW(15,74) dist=15.5
  console.log('✓ o32 Ph1: D1 backs off to {30,70}');
}

// ── VALIDATION ────────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (batch 3) ═══');
let issues = 0;
['fc12','fc21','bck','d21','d32','o21','o32'].forEach(id => {
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
for (const id of ['fc12','fc21','bck','d21','d32','o21','o32']) {
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
