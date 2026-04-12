// fix_defenders.mjs
// Places each defender on the geometric line between their assigned opponent and our net (x:50, y:6).
// Run: node fix_defenders.mjs

import { readFileSync, writeFileSync } from 'fs';

const NET_X = 50;
const NET_Y = 6;
const DIST = 7;
const OVERLAP = 8;
const NUDGE = 3;
const MAX_MOVE = 14;

const DEFENSIVE_TACTIC_IDS = [
  'watch-your-man',
  'protect-the-middle',
  'gap-control',
  'defensive-box-pk',
  'communication-defense',
];

// ─── Geometry ──────────────────────────────────────────────────────────────

function placeOnLine(ox, oy) {
  const dx = NET_X - ox;
  const dy = NET_Y - oy;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: ox, y: oy };
  return { x: Math.round(ox + (dx / len) * DIST), y: Math.round(oy + (dy / len) * DIST) };
}

function nudgePerp(pos, ox, oy) {
  const dx = NET_X - ox;
  const dy = NET_Y - oy;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return pos;
  return { x: Math.round(pos.x + (-dy / len) * NUDGE), y: Math.round(pos.y + (dx / len) * NUDGE) };
}

function eucl(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ─── Overlap resolution ────────────────────────────────────────────────────

function resolveOverlaps(positions, coverage, oppById, label) {
  const keys = Object.keys(positions);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const ki = keys[i], kj = keys[j];
      if (ki === 'G' && kj === 'G') continue;
      const d = eucl(positions[ki], positions[kj]);
      if (d < OVERLAP) {
        console.log(`  OVERLAP [${label}]: ${ki}(${positions[ki].x},${positions[ki].y}) & ${kj}(${positions[kj].x},${positions[kj].y}) dist=${d.toFixed(1)} — nudging ${kj}`);
        const oppId = coverage[kj];
        const opp = oppId && oppById[oppId];
        if (opp) {
          positions[kj] = nudgePerp(positions[kj], opp.x, opp.y);
        } else {
          positions[kj] = { x: positions[kj].x + NUDGE, y: positions[kj].y };
        }
        console.log(`    → ${kj} nudged to (${positions[kj].x},${positions[kj].y})`);
      }
    }
  }
}

// ─── Change log ────────────────────────────────────────────────────────────

const allChanges = []; // { file, playId, anchor, player, oldX, oldY, newX, newY }

function logChange(file, playId, anchor, player, oldX, oldY, newX, newY) {
  if (oldX === newX && oldY === newY) return;
  console.log(`  CHANGE [${file}][${anchor}] ${player}: (${oldX},${oldY}) → (${newX},${newY})`);
  allChanges.push({ file, playId, anchor, player, oldX, oldY, newX, newY });
}

// ─── Process tactics.js ────────────────────────────────────────────────────

async function processTactics() {
  const { TACTICS } = await import('./src/data/tactics.js');
  console.log('\n=== TACTICS.JS ===');

  for (const tactic of TACTICS) {
    if (!DEFENSIVE_TACTIC_IDS.includes(tactic.id)) continue;
    const { correctScene } = tactic;
    if (!correctScene) continue;

    const coverage = correctScene.coverage || {};
    if (Object.keys(coverage).length === 0) {
      console.log(`[${tactic.id}] no coverage map — skip`);
      continue;
    }

    console.log(`\n[${tactic.id}] coverage: ${JSON.stringify(coverage)}`);

    for (let pi = 1; pi < correctScene.phases.length; pi++) {
      const phase = correctScene.phases[pi];
      const { our, opp, caption } = phase;

      const oppById = {};
      for (const o of opp) oppById[o.id] = o;

      // Compute new positions
      const newPos = {};
      for (const [defKey, oppId] of Object.entries(coverage)) {
        const op = oppById[oppId];
        if (!op || !our[defKey]) continue;
        newPos[defKey] = placeOnLine(op.x, op.y);
      }

      // Add G for overlap check (fixed)
      if (our.G) newPos.G = { x: our.G.x, y: our.G.y };

      // Overlap
      resolveOverlaps(newPos, coverage, oppById, `${tactic.id}/ph${pi}`);

      // Record
      for (const defKey of Object.keys(coverage)) {
        if (!our[defKey] || !newPos[defKey]) continue;
        logChange('tactics', tactic.id, caption, defKey, our[defKey].x, our[defKey].y, newPos[defKey].x, newPos[defKey].y);
      }
    }
  }
}

// ─── Auto coverage for plays.js ────────────────────────────────────────────

function buildPlaysCoverage(pos, opp) {
  // Exclude goalie
  const opps = opp.filter(o => o.id !== 'og' && !o.isGoalie);
  if (!opps.length) return {};

  // Sort by y ascending (lower y = closer to our net = their forwards)
  const byY = [...opps].sort((a, b) => a.y - b.y);
  const splitAt = Math.ceil(byY.length / 2);
  const fwds = byY.slice(0, splitAt).sort((a, b) => a.x - b.x);   // closer to our net, sorted left→right
  const defs = byY.slice(splitAt).sort((a, b) => a.x - b.x);      // further, sorted left→right

  const cov = {};
  if (fwds.length >= 1 && pos.LD) cov.LD = fwds[0].id;
  if (fwds.length >= 2 && pos.RD) cov.RD = fwds[fwds.length - 1].id;
  if (fwds.length >= 3 && pos.C)  cov.C  = fwds[Math.floor(fwds.length / 2)].id;
  if (defs.length >= 1 && pos.LW) cov.LW = defs[0].id;
  if (defs.length >= 2 && pos.RW) cov.RW = defs[defs.length - 1].id;

  return cov;
}

function ourHasBall(pos) {
  return Object.values(pos).some(p => p && p.ball === true);
}

async function processPlays() {
  const { PLAYS } = await import('./src/data/plays.js');
  console.log('\n=== PLAYS.JS ===');

  for (const play of PLAYS) {
    if (play.cat !== 'defensive') continue;

    for (const phase of play.phases) {
      if (phase.id === 0) continue;                                    // skip initial alignment
      const pos = phase.pos;
      if (!pos) continue;
      if (ourHasBall(pos)) continue;                                   // our team has ball = breakout
      if (phase.ball && phase.ball.y < 10) continue;                   // ball behind/at our net

      // Require title to not be a pure alignment phase
      if (phase.t && /alignment/i.test(phase.t)) continue;

      // Majority of skaters in our zone (y < 36)
      const skaters = ['LW', 'C', 'RW', 'LD', 'RD'].map(k => pos[k]).filter(Boolean);
      const inZone = skaters.filter(p => p.y < 36).length;
      if (inZone < Math.ceil(skaters.length * 0.6)) continue;

      const opp = phase.opp || [];
      const oppById = {};
      for (const o of opp) oppById[o.id] = o;

      const coverage = buildPlaysCoverage(pos, opp);
      if (!Object.keys(coverage).length) continue;

      console.log(`\n[${play.id}/phase${phase.id}] "${phase.t}" coverage: ${JSON.stringify(coverage)}`);

      const newPos = {};
      for (const [defKey, oppId] of Object.entries(coverage)) {
        const op = oppById[oppId];
        if (!op || !pos[defKey]) continue;
        const np = placeOnLine(op.x, op.y);
        const movement = eucl(np, pos[defKey]);
        if (movement > MAX_MOVE) {
          console.log(`  SKIP [${play.id}/ph${phase.id}] ${defKey}: movement ${movement.toFixed(1)} > ${MAX_MOVE}`);
          continue;
        }
        newPos[defKey] = np;
      }

      // G for overlap check
      if (pos.G && typeof pos.G === 'object') {
        newPos.G = { x: pos.G.x || 50, y: pos.G.y || 8 };
      } else {
        newPos.G = { x: 50, y: 8 };
      }

      resolveOverlaps(newPos, coverage, oppById, `${play.id}/ph${phase.id}`);

      for (const defKey of Object.keys(coverage)) {
        if (!pos[defKey] || !newPos[defKey]) continue;
        logChange('plays', play.id, phase.t, defKey, pos[defKey].x, pos[defKey].y, newPos[defKey].x, newPos[defKey].y);
      }
    }
  }
}

// ─── Apply changes to file content ─────────────────────────────────────────

// Find anchor in content, trying both literal apostrophe and escaped form.
function findAnchor(content, anchor, fromIdx = 0) {
  let idx = content.indexOf(anchor, fromIdx);
  if (idx !== -1) return idx;
  // Try with escaped apostrophe (JS source files use \' inside single-quoted strings)
  const escaped = anchor.replace(/'/g, "\\'");
  idx = content.indexOf(escaped, fromIdx);
  return idx; // -1 if still not found
}

function applyTacticsChanges(content, changes) {
  let modified = content;
  for (const ch of changes) {
    const anchorIdx = findAnchor(modified, ch.anchor);
    if (anchorIdx === -1) {
      console.error(`  ERROR: anchor not found: "${ch.anchor.slice(0, 70)}"`);
      continue;
    }
    const regionEnd = anchorIdx + 700;
    const region = modified.slice(anchorIdx, regionEnd);
    const old = `${ch.player}:{x:${ch.oldX},y:${ch.oldY}}`;
    const neu = `${ch.player}:{x:${ch.newX},y:${ch.newY}}`;
    if (!region.includes(old)) {
      console.error(`  ERROR: pattern not found: "${old}" near "${ch.anchor.slice(0, 50)}"`);
      continue;
    }
    const newRegion = region.replace(old, neu);
    modified = modified.slice(0, anchorIdx) + newRegion + modified.slice(regionEnd);
    console.log(`  OK: [${ch.player}] (${ch.oldX},${ch.oldY}) → (${ch.newX},${ch.newY})`);
  }
  return modified;
}

function applyPlaysChanges(content, changes) {
  let modified = content;
  for (const ch of changes) {
    // Find the play block first using play ID (unique per play)
    const playIdAnchor = `id:"${ch.playId}"`;
    const playIdx = modified.indexOf(playIdAnchor);
    if (playIdx === -1) {
      console.error(`  ERROR: play ID not found: "${ch.playId}"`);
      continue;
    }
    // Find the phase title within the next 4000 chars
    const playRegionEnd = playIdx + 4000;
    const playRegion = modified.slice(playIdx, playRegionEnd);
    const phaseIdx = playRegion.indexOf(ch.anchor);
    if (phaseIdx === -1) {
      console.error(`  ERROR: phase title not found in play "${ch.playId}": "${ch.anchor}"`);
      continue;
    }
    const absPhaseIdx = playIdx + phaseIdx;
    const regionEnd = absPhaseIdx + 700;
    const region = modified.slice(absPhaseIdx, regionEnd);

    const oldWithComma = `${ch.player}:{x:${ch.oldX},y:${ch.oldY},`;
    const neuWithComma = `${ch.player}:{x:${ch.newX},y:${ch.newY},`;
    const oldClean     = `${ch.player}:{x:${ch.oldX},y:${ch.oldY}}`;
    const neuClean     = `${ch.player}:{x:${ch.newX},y:${ch.newY}}`;

    let newRegion = null;
    if (region.includes(oldWithComma))  newRegion = region.replace(oldWithComma, neuWithComma);
    else if (region.includes(oldClean)) newRegion = region.replace(oldClean, neuClean);

    if (!newRegion) {
      console.error(`  ERROR: pattern not found for ${ch.player}(${ch.oldX},${ch.oldY}) in play "${ch.playId}"`);
      continue;
    }
    modified = modified.slice(0, absPhaseIdx) + newRegion + modified.slice(regionEnd);
    console.log(`  OK: [${ch.playId}/${ch.player}] (${ch.oldX},${ch.oldY}) → (${ch.newX},${ch.newY})`);
  }
  return modified;
}

// ─── Main ──────────────────────────────────────────────────────────────────

console.log('=== Defensive Line-Positioning Fix ===');
console.log(`Net: (${NET_X},${NET_Y})  Dist: ${DIST}  Overlap threshold: ${OVERLAP}  Max move: ${MAX_MOVE}\n`);

await processTactics();
await processPlays();

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total changes: ${allChanges.length}`);

if (allChanges.length === 0) {
  console.log('No changes needed.');
  process.exit(0);
}

// Write tactics.js
const tacticsChanges = allChanges.filter(c => c.file === 'tactics');
if (tacticsChanges.length > 0) {
  console.log(`\nWriting tactics.js (${tacticsChanges.length} changes)...`);
  let content = readFileSync('./src/data/tactics.js', 'utf8');
  content = applyTacticsChanges(content, tacticsChanges);
  writeFileSync('./src/data/tactics.js', content, 'utf8');
  console.log('tactics.js written.');
}

// Write plays.js
const playsChanges = allChanges.filter(c => c.file === 'plays');
if (playsChanges.length > 0) {
  console.log(`\nWriting plays.js (${playsChanges.length} changes)...`);
  let content = readFileSync('./src/data/plays.js', 'utf8');
  content = applyPlaysChanges(content, playsChanges);
  writeFileSync('./src/data/plays.js', content, 'utf8');
  console.log('plays.js written.');
}

console.log('\n=== Done ===');
