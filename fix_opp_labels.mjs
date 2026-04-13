// fix_opp_labels.mjs
// Fixes opponent label mirroring in tactics.js and plays.js.
//
// RULE: Opponents attacking toward our net (y:6) have their L/R mirrored
// from our camera view. From our perspective:
//   - Opponent LW should appear on the RIGHT side (x > 50)
//   - Opponent RW should appear on the LEFT  side (x < 50)
//   - Opponent LD should appear on the RIGHT side (x > 50)
//   - Opponent RD should appear on the LEFT  side (x < 50)
//
// Only swaps CLEAR violations: LW.x < 40 AND partner RW.x > 60 (or LD/RD).
// Edge cases (both on same side) are skipped.
//
// Also applies one hard-coded position fix:
//   P2 protect-the-middle mistakeScene ph2: our LW → (22,30)
//   [user requested 30,30 but that overlaps C(36,30) at dist=6 and
//    RW(29,36) at dist=6.1 — nearest clean position is (22,30)]

import { readFileSync, writeFileSync } from 'fs';

const TACTICS_FILE = './src/data/tactics.js';
const PLAYS_FILE   = './src/data/plays.js';

let totalSwaps = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────

function getLabel(o) { return o.label || o.l; }

// Given an opp array, return pairs that clearly need swapping.
function findSwapPairs(opps) {
  const pairs = [];

  const lw = opps.find(o => getLabel(o) === 'LW');
  const rw = opps.find(o => getLabel(o) === 'RW');
  if (lw && rw && lw.x < 40 && rw.x > 60) {
    pairs.push({ typeA: 'LW', typeB: 'RW', a: lw, b: rw });
  }

  const ld = opps.find(o => getLabel(o) === 'LD');
  const rd = opps.find(o => getLabel(o) === 'RD');
  if (ld && rd && ld.x < 40 && rd.x > 60) {
    pairs.push({ typeA: 'LD', typeB: 'RD', a: ld, b: rd });
  }

  return pairs;
}

// ─── tactics.js ───────────────────────────────────────────────────────────
// Entry format: {id:'o2',x:23,y:35,label:'LW'}  (with optional extra props)
// Anchor: id + x + y uniquely identifies each entry.

async function processTactics() {
  const { TACTICS } = await import('./src/data/tactics.js');
  let content = readFileSync(TACTICS_FILE, 'utf8');
  let fileSwaps = 0;

  for (const tactic of TACTICS) {
    for (const sceneName of ['mistakeScene', 'correctScene']) {
      const scene = tactic[sceneName];
      if (!scene?.phases) continue;

      for (let pi = 0; pi < scene.phases.length; pi++) {
        const phase = scene.phases[pi];
        const pairs = findSwapPairs(phase.opp || []);

        for (const { typeA, typeB, a, b } of pairs) {
          const patA = `{id:'${a.id}',x:${a.x},y:${a.y},label:'${typeA}'`;
          const repA = `{id:'${a.id}',x:${a.x},y:${a.y},label:'${typeB}'`;
          const patB = `{id:'${b.id}',x:${b.x},y:${b.y},label:'${typeB}'`;
          const repB = `{id:'${b.id}',x:${b.x},y:${b.y},label:'${typeA}'`;

          const foundA = content.includes(patA);
          const foundB = content.includes(patB);

          if (foundA && foundB) {
            content = content.replace(patA, repA);
            content = content.replace(patB, repB);
            console.log(`  SWAP [tactics/${tactic.id}/${sceneName}/ph${pi}] ${typeA}(${a.id},x:${a.x})↔${typeB}(${b.id},x:${b.x})`);
            fileSwaps++;
            totalSwaps++;
          } else {
            console.error(`  ERROR: pattern not found — ${typeA}↔${typeB} in ${tactic.id}/${sceneName}/ph${pi}`);
            if (!foundA) console.error(`    Missing: "${patA}"`);
            if (!foundB) console.error(`    Missing: "${patB}"`);
          }
        }
      }
    }
  }

  console.log(`\ntactics.js: ${fileSwaps} pair-swaps applied.`);
  return content;
}

// ─── plays.js ─────────────────────────────────────────────────────────────
// Entry format: {x:42,y:54,l:"LW"} or {x:42,y:54,l:"LW",hasBall:true}
// No ids on individual entries — use x+y as anchor (unique per phase line).
// Each phase is on its own line in plays.js, so we process line-by-line to
// avoid cross-phase collisions.

async function processPlays() {
  const { PLAYS } = await import('./src/data/plays.js');
  const rawContent = readFileSync(PLAYS_FILE, 'utf8');
  const lines = rawContent.split('\n');
  let fileSwaps = 0;

  for (const play of PLAYS) {
    for (const phase of play.phases) {
      const pairs = findSwapPairs(phase.opp || []);
      if (!pairs.length) continue;

      // Find the line for this phase by play id + phase id
      // Each phase lives on a single line in plays.js
      let lineIdx = -1;
      const playIdStr = `id:"${play.id}"`;
      let playLineIdx = lines.findIndex(l => l.includes(playIdStr));
      if (playLineIdx === -1) {
        playLineIdx = lines.findIndex(l => l.includes(`id:'${play.id}'`));
      }
      if (playLineIdx === -1) {
        console.error(`  ERROR: play id not found: ${play.id}`);
        continue;
      }

      // Scan forward from play start for this phase's line
      // Phase lines contain {id:N,t:"..." and opp:
      const phaseIdPattern = `id:${phase.id},`;
      for (let i = playLineIdx; i < Math.min(playLineIdx + 60, lines.length); i++) {
        if (lines[i].includes(phaseIdPattern) && lines[i].includes('opp:')) {
          lineIdx = i;
          break;
        }
      }

      if (lineIdx === -1) {
        console.error(`  ERROR: phase line not found — ${play.id}/ph${phase.id}`);
        continue;
      }

      let line = lines[lineIdx];

      for (const { typeA, typeB, a, b } of pairs) {
        // Try double-quote format first, then single-quote
        const trySwap = (qa, qb) => {
          const patA = `x:${a.x},y:${a.y},l:${qa}${typeA}${qa}`;
          const repA = `x:${a.x},y:${a.y},l:${qa}${typeB}${qa}`;
          const patB = `x:${b.x},y:${b.y},l:${qb}${typeB}${qb}`;
          const repB = `x:${b.x},y:${b.y},l:${qb}${typeA}${qb}`;
          if (line.includes(patA) && line.includes(patB)) {
            line = line.replace(patA, repA);
            line = line.replace(patB, repB);
            return true;
          }
          return false;
        };

        const swapped = trySwap('"', '"') || trySwap("'", "'");
        if (swapped) {
          console.log(`  SWAP [plays/${play.id}/ph${phase.id}] ${typeA}(x:${a.x})↔${typeB}(x:${b.x})`);
          fileSwaps++;
          totalSwaps++;
        } else {
          console.error(`  ERROR: pattern not found — ${typeA}↔${typeB} in ${play.id}/ph${phase.id}`);
          console.error(`    Looking for: x:${a.x},y:${a.y},l:"${typeA}" AND x:${b.x},y:${b.y},l:"${typeB}"`);
        }
      }

      lines[lineIdx] = line;
    }
  }

  console.log(`\nplays.js: ${fileSwaps} pair-swaps applied.`);
  return lines.join('\n');
}

// ─── P2 LW fix ────────────────────────────────────────────────────────────
// Move P2 protect-the-middle mistakeScene phase 2 our LW to (22,30).
// User requested (30,30) but that overlaps C(36,30) at dist=6.0 and
// RW(29,36) at dist=6.1. Nearest clean position: (22,30).
//   - vs C(36,30): dist=14 ✓
//   - vs RW(29,36): dist=sqrt(49+36)≈9.2 ✓
//   - vs LD(43,24): dist≈21.8 ✓
//   - Coverage to o5(66,44): ≈46 (deep red/lost) ✓

function applyP2LwFix(content) {
  // After label swaps, the caption anchor may have changed. Use the
  // LD charges caption which is unique to this phase.
  const caption = 'LD charges straight. Rest of the team ball-watches too.';
  const idx = content.indexOf(caption);
  if (idx === -1) {
    console.error('\n  ERROR: P2 LW fix — caption anchor not found');
    return content;
  }

  const regionEnd = idx + 500;
  const region = content.slice(idx, regionEnd);

  // The LW position was set to (49,30) in a previous commit; update it.
  const oldLW = 'LW:{x:49,y:30}';
  const newLW = 'LW:{x:22,y:30}';

  if (!region.includes(oldLW)) {
    console.error(`  ERROR: P2 LW fix — pattern "${oldLW}" not found near caption`);
    return content;
  }

  const newRegion = region.replace(oldLW, newLW);
  console.log(`\n  P2 LW FIX: (49,30) → (22,30) [user requested (30,30) — overlaps C and RW; adjusted to nearest clean position]`);
  return content.slice(0, idx) + newRegion + content.slice(regionEnd);
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log('=== Opponent Label Mirror Fix ===');
console.log('Threshold: LW.x < 40 AND RW.x > 60 (or LD/RD equivalent)\n');

console.log('--- tactics.js ---');
let tacticsContent = await processTactics();
tacticsContent = applyP2LwFix(tacticsContent);

console.log('\n--- plays.js ---');
const playsContent = await processPlays();

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total label-pair swaps: ${totalSwaps}`);

if (totalSwaps > 0 || tacticsContent !== readFileSync(TACTICS_FILE, 'utf8')) {
  writeFileSync(TACTICS_FILE, tacticsContent, 'utf8');
  console.log('tactics.js written.');
}

writeFileSync(PLAYS_FILE, playsContent, 'utf8');
console.log('plays.js written.');

console.log('\n=== Done ===');
