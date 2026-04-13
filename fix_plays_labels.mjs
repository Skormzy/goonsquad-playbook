// fix_plays_labels.mjs
// FIX 3: Replace ALL opponent labels in plays.js with generic labels.
//   Forwards (lower y = closer to our net y:6 = pressing toward us): F1, F2, F3 (left→right by x)
//   Defensemen (higher y = further back): D1, D2 (left→right by x)
//   Goalie: unchanged (G / id:"og")
//   Sort by y ascending → first ceil(N/2) = forwards, rest = defenders.
//
// Only updates entries where at least one opponent has a position-based label
// (C, LW, RW, LD, RD). Plays already fully generic are skipped.

import { readFileSync, writeFileSync } from 'fs';

const PLAYS_FILE = './src/data/plays.js';
const rawContent = readFileSync(PLAYS_FILE, 'utf8');
const lines = rawContent.split('\n');

let totalChanges = 0;
const POS_LABELS = new Set(['C', 'LW', 'RW', 'LD', 'RD']);

// Build generic label mapping for an opp array
function buildLabelMap(opp) {
  const nonGoalies = opp.filter(o => o.id !== 'og' && o.l !== 'G' && !o.isGoalie);
  if (!nonGoalies.length) return {};

  // Sort by y ascending, x as tiebreaker
  const sorted = [...nonGoalies].sort((a, b) => a.y - b.y || a.x - b.x);
  const splitAt = Math.ceil(sorted.length / 2);

  const fwds = sorted.slice(0, splitAt).sort((a, b) => a.x - b.x);
  const defs = sorted.slice(splitAt).sort((a, b) => a.x - b.x);

  const map = {}; // id → new label
  fwds.forEach((o, i) => { map[o.id] = `F${i + 1}`; });
  defs.forEach((o, i) => { map[o.id] = `D${i + 1}`; });
  return map;
}

// Find the `opp:` line for a given play+phase combo.
// Strategy: find play id line, then scan forward for phase title, then for opp: line.
function findOppLine(lines, playId, phaseTitle) {
  const playAnchor = `id:"${playId}"`;
  const playLineIdx = lines.findIndex(l => l.includes(playAnchor));
  if (playLineIdx === -1) return -1;

  // Scan forward up to 200 lines for phase title
  const titleSearch = phaseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex
  const phaseLineIdx = (() => {
    for (let i = playLineIdx; i < Math.min(playLineIdx + 200, lines.length); i++) {
      if (lines[i].includes(phaseTitle)) return i;
    }
    return -1;
  })();
  if (phaseLineIdx === -1) return -1;

  // Scan forward up to 5 lines for opp:
  for (let i = phaseLineIdx; i < Math.min(phaseLineIdx + 6, lines.length); i++) {
    if (lines[i].includes('opp:')) return i;
  }
  return -1;
}

// Apply label replacements on a single line.
// For each opponent, replace: x:N,y:M,l:"OLD" → x:N,y:M,l:"NEW"
// Returns { newLine, changesOnLine }
function applyLabelChanges(line, opp, labelMap) {
  let newLine = line;
  let count = 0;

  for (const o of opp) {
    if (o.id === 'og' || o.l === 'G' || o.isGoalie) continue;
    const newLabel = labelMap[o.id];
    if (!newLabel || newLabel === o.l) continue;

    const oldPattern = `x:${o.x},y:${o.y},l:"${o.l}"`;
    const newPattern = `x:${o.x},y:${o.y},l:"${newLabel}"`;

    if (newLine.includes(oldPattern)) {
      newLine = newLine.replace(oldPattern, newPattern);
      count++;
    } else {
      // Try single quotes
      const oldPatternSQ = `x:${o.x},y:${o.y},l:'${o.l}'`;
      const newPatternSQ = `x:${o.x},y:${o.y},l:'${newLabel}'`;
      if (newLine.includes(oldPatternSQ)) {
        newLine = newLine.replace(oldPatternSQ, newPatternSQ);
        count++;
      } else {
        console.error(`  ERROR: pattern not found: "${oldPattern}" in play opp line`);
      }
    }
  }

  return { newLine, count };
}

// ─── Process ──────────────────────────────────────────────────────────────────

console.log('=== FIX 3: Generic Opponent Labels in plays.js ===\n');
console.log('Rule: sort by y asc → first ceil(N/2)=Forwards (F1..Fn by x), rest=Defenders (D1..Dn by x)\n');

const { PLAYS } = await import('./src/data/plays.js');

for (const play of PLAYS) {
  for (const phase of play.phases) {
    const opp = phase.opp || [];

    // Check if any non-goalie has a position-based label
    const hasPosBased = opp.some(o =>
      o.id !== 'og' && o.l !== 'G' && !o.isGoalie && POS_LABELS.has(o.l)
    );
    if (!hasPosBased) continue;

    // Build mapping
    const labelMap = buildLabelMap(opp);

    // Find line index for this phase's opp:
    const phaseTitle = phase.t;
    if (!phaseTitle) {
      console.error(`  ERROR: phase has no title — ${play.id}/ph${phase.id}`);
      continue;
    }

    const oppLineIdx = findOppLine(lines, play.id, phaseTitle);
    if (oppLineIdx === -1) {
      console.error(`  ERROR: opp line not found — ${play.id}/"${phaseTitle}"`);
      continue;
    }

    const { newLine, count } = applyLabelChanges(lines[oppLineIdx], opp, labelMap);

    if (count > 0) {
      lines[oppLineIdx] = newLine;
      totalChanges += count;
      // Print summary for this phase
      const assignments = opp
        .filter(o => o.id !== 'og' && o.l !== 'G' && !o.isGoalie)
        .map(o => `${o.l}→${labelMap[o.id] || o.l}`)
        .join(', ');
      console.log(`  [${play.id}/ph${phase.id}] "${phaseTitle}" — ${assignments}`);
    }
  }
}

console.log(`\nFIX 3: ${totalChanges} label changes applied.\n`);

// ─── Write ────────────────────────────────────────────────────────────────────

const newContent = lines.join('\n');
if (newContent !== rawContent) {
  writeFileSync(PLAYS_FILE, newContent, 'utf8');
  console.log('plays.js written.');
} else {
  console.log('No changes to plays.js.');
}

console.log('\n=== Done ===');
