// fix_batch2_adv.mjs — address 4 adversarial findings from batch 2 commit
// 1. HIGH: remove unused o4g helper (ESLint no-unused-vars)
// 2. MED:  zent Ph1 D1 at {12,82} same column as carrier — move to {32,78} (backing up w/ gap)
// 3. MED:  pts Ph0 F3 at {44,74} weakens screen — restore near net at {34,90}
//          pts Ph1 F3 at {60,90} too deep — restore net-front at {34,84}
// 4. LOW:  trap Ph1 F1 was carrier at ball {15,62} — move LW instead so F1 stays at ball

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let rawSrc = readFileSync('./src/data/plays.js', 'utf8');

// ── Fix 1: remove unused o4g helper ──────────────────────────────────────────
rawSrc = rawSrc.replace(
  /^const o4g = .*;\n/m,
  ''
);
console.log('✓ Removed o4g helper');

const code = rawSrc
  .replace(/^export const /mg, 'const ')
  .replace(/^export /mg, '');
const { PLAYS, GK } = new Function('require', code + '; return { PLAYS, GK };')(require);

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function play(id) { return PLAYS.find(p => p.id === id); }
function ph(id, i) { return play(id).phases[i]; }
function opp(phase, id) { return phase.opp.find(o => o.id === id); }

// ── Fix 2: zent Ph1 D1 ───────────────────────────────────────────────────────
// D1 at {12,82} is same column as carrier LW{12,74} — looks beaten, not "backing up"
// Move D1 to {32,78}: gives space, sits in slot between carrier and net
{
  const p = ph('zent', 1);
  opp(p, 'o1').x = 32; opp(p, 'o1').y = 78;  // D1 → {32,78}  LW dist=20.4, F2(22,80) dist=10.2
  console.log('✓ zent Ph1: D1 to slot position {32,78}');
}

// ── Fix 3: pts Ph0 F3 ────────────────────────────────────────────────────────
// F3 was moved to {44,74} (slot) — weakens net-front traffic teaching point
// Restore near net at {34,90}: defender deep protecting crease
{
  const p = ph('pts', 0);
  opp(p, 'o5').x = 34; opp(p, 'o5').y = 90;  // F3 → {34,90}  C(40,83) dist=9.2, F1(34,74) dist=16
  console.log('✓ pts Ph0: F3 restored near net {34,90}');
}

// ── Fix 3b: pts Ph1 F3 ───────────────────────────────────────────────────────
// F3 at {60,90} is "too deep, one defender at post" — restore net-front at {34,84}
{
  const p = ph('pts', 1);
  opp(p, 'o5').x = 34; opp(p, 'o5').y = 84;  // F3 → {34,84}  C(42,86) dist=8.2, D1(26,80) dist=8.9
  console.log('✓ pts Ph1: F3 restored net-front {34,84}');
}

// ── Fix 4: trap Ph1 — move LW, keep F1 at ball ───────────────────────────────
// F1 was moved off ball {15,62}; move LW instead to preserve F1-ball connection
{
  const p = ph('trap', 1);
  // Restore F1 to ball position (it was moved to {10,64} in batch 2)
  opp(p, 'o1').x = 15; opp(p, 'o1').y = 62;  // F1 back at ball {15,62}
  p.pos.LW = { ...p.pos.LW, x: 22, y: 50 };  // LW → {22,50}  F1 dist=13.9, LD(25,42) dist=8.5
  console.log('✓ trap Ph1: F1 restored to ball, LW spread to boards');
}

// ── VALIDATION ────────────────────────────────────────────────────────────────
console.log('\n═══ OVERLAP CHECK (affected plays) ═══');
let issues = 0;
['zent','pts','trap'].forEach(id => {
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

// ── SERIALIZE affected plays + write (o4g already removed from rawSrc) ────────
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

let out = rawSrc;  // already has o4g removed
for (const id of ['zent','pts','trap']) {
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
