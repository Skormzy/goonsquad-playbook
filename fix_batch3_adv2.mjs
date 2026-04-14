// fix_batch3_adv2.mjs — second adversarial pass on batch 3
// 1. o21 Ph1 F1: was at {44,70} — sits on LW→C passing lane (y≈72)
//    Fix: F1 → {50,65} — backchecking forward above the play, lane stays clear
// 2. d32 Ph1 LD: was at {38,14} — too close to carrier, widened D-D gap to 18
//    Fix: LD → {42,14} — x=42-44 range keeps LD inside carrier and D-D gap at 14

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

// ── Fix 1: o21 Ph1 F1 ────────────────────────────────────────────────────────
// F1(44,70) sits on LW(25,72)→C(55,72) horizontal passing lane
// Move to {50,65}: backchecking forward above the play — lane stays clear
{
  const p = ph('o21', 1);
  opp(p, 'o2').x = 50; opp(p, 'o2').y = 65;  // F1 → {50,65}  C(55,72) dist=8.6
  console.log('✓ o21 Ph1: F1 to {50,65} — above play, passing lane clear');
}

// ── Fix 2: d32 Ph1 LD ────────────────────────────────────────────────────────
// LD(38,14) widened D-D gap to 18; move to {42,14} — still inside carrier, gap=14
{
  const p = ph('d32', 1);
  p.pos.LD = { ...p.pos.LD, x: 42, y: 14 };  // LD → {42,14}  F1(32,22) dist=12.8, RD(56,14) gap=14
  console.log('✓ d32 Ph1: LD to {42,14} — tighter D-D connection, inside carrier');
}

// ── VALIDATION ────────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (o21, d32) ═══');
let issues = 0;
['o21','d32'].forEach(id => {
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

// ── SERIALIZE o21, d32 ────────────────────────────────────────────────────────
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
for (const id of ['o21','d32']) {
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
