// fix_our_sides.mjs
// FIX 1: Scan every `our:` line in tactics.js.
//   If LW.x > 55 AND RW.x < 45 → swap their entire coordinate objects (keep labels).
//   If LD.x > 55 AND RD.x < 45 → swap their entire coordinate objects (keep labels).
//   Purely text-based: no import needed, no caption-matching issues.
//   Does NOT touch opponent positions.
//
// FIX 2: Fix P2 protect-the-middle mistakeScene phase 1:
//   After FIX 1, phase 0 LW swaps from (69,42) → (31,41).
//   Phase 1 LW at (22,30) is in the WRONG direction (drifts LEFT, away from ball at x:47).
//   Corrected to (42,38): 11.4-unit drift rightward toward ball, amber coverage.
//   Overlap check: vs C(36,30)=10.0 ✓  vs RW(29,36)=13.2 ✓  vs LD(43,24)=14.0 ✓

import { readFileSync, writeFileSync } from 'fs';

const TACTICS_FILE = './src/data/tactics.js';
const rawContent = readFileSync(TACTICS_FILE, 'utf8');
const lines = rawContent.split('\n');

let totalSwaps = 0;

// Extract full LABEL:{...} match from a line
function extractPlayer(line, label) {
  const re = new RegExp(`(${label}:\\{[^}]+\\})`);
  const m = line.match(re);
  return m ? m[1] : null;
}

function getX(playerStr) {
  const m = playerStr.match(/x:(\d+)/);
  return m ? parseInt(m[1]) : null;
}

// Find nearest caption (for logging context only)
function findNearestCaption(lines, fromIdx) {
  for (let i = fromIdx; i >= Math.max(0, fromIdx - 6); i--) {
    const m = lines[i].match(/caption:\s*['"]([^'"]{0,60})/);
    if (m) return m[1];
  }
  return '(unknown)';
}

// Find nearest tactic/scene id (for logging context only)
function findNearestContext(lines, fromIdx) {
  for (let i = fromIdx; i >= Math.max(0, fromIdx - 80); i--) {
    const scene = lines[i].match(/(mistakeScene|correctScene):/);
    if (scene) {
      for (let j = i; j >= Math.max(0, i - 30); j--) {
        const tid = lines[j].match(/id:\s*'([^']+)'/);
        if (tid) return `${tid[1]}/${scene[1]}`;
      }
    }
  }
  return '(unknown)';
}

// ─── FIX 1 ────────────────────────────────────────────────────────────────────

console.log('=== FIX 1: Our Player Side Correction (tactics.js) ===\n');
console.log('Threshold: LW.x > 55 AND RW.x < 45 (or LD/RD equivalent)\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Only process `our:` lines that have both LW and RW (or LD and RD)
  if (!line.includes('our:')) continue;

  let modified = line;

  // ── LW / RW ──
  if (line.includes('LW:') && line.includes('RW:')) {
    const lwStr = extractPlayer(modified, 'LW');
    const rwStr = extractPlayer(modified, 'RW');
    if (lwStr && rwStr) {
      const lwX = getX(lwStr);
      const rwX = getX(rwStr);
      if (lwX !== null && rwX !== null && lwX > 55 && rwX < 45) {
        const lwInner = lwStr.slice('LW:{'.length, -1);
        const rwInner = rwStr.slice('RW:{'.length, -1);
        modified = modified
          .replace(lwStr, '\x00LW_PH\x00')
          .replace(rwStr, '\x00RW_PH\x00')
          .replace('\x00LW_PH\x00', `LW:{${rwInner}}`)
          .replace('\x00RW_PH\x00', `RW:{${lwInner}}`);
        const ctx = findNearestContext(lines, i);
        const cap = findNearestCaption(lines, i);
        console.log(`  SWAP LW/RW [${ctx}] LW(${lwX})↔RW(${rwX}) — "${cap}"`);
        totalSwaps++;
      }
    }
  }

  // ── LD / RD ──
  if (modified.includes('LD:') && modified.includes('RD:')) {
    const ldStr = extractPlayer(modified, 'LD');
    const rdStr = extractPlayer(modified, 'RD');
    if (ldStr && rdStr) {
      const ldX = getX(ldStr);
      const rdX = getX(rdStr);
      if (ldX !== null && rdX !== null && ldX > 55 && rdX < 45) {
        const ldInner = ldStr.slice('LD:{'.length, -1);
        const rdInner = rdStr.slice('RD:{'.length, -1);
        modified = modified
          .replace(ldStr, '\x00LD_PH\x00')
          .replace(rdStr, '\x00RD_PH\x00')
          .replace('\x00LD_PH\x00', `LD:{${rdInner}}`)
          .replace('\x00RD_PH\x00', `RD:{${ldInner}}`);
        const ctx = findNearestContext(lines, i);
        const cap = findNearestCaption(lines, i);
        console.log(`  SWAP LD/RD [${ctx}] LD(${ldX})↔RD(${rdX}) — "${cap}"`);
        totalSwaps++;
      }
    }
  }

  lines[i] = modified;
}

console.log(`\nFIX 1: ${totalSwaps} swaps applied.\n`);

// ─── FIX 2 ────────────────────────────────────────────────────────────────────
// After FIX 1, P2 mistakeScene phase 0 LW is at (31,41) [swapped from (69,42)].
// Phase 1 (caption: "LD charges straight...") has LW:{x:22,y:30} — wrong direction.
// New position (42,38):
//   Drift from (31,41): sqrt(11²+3²) ≈ 11.4 units toward ball (x:47) ✓ (in 8-12 range)
//   Coverage to o5(66,44): sqrt(576+36) ≈ 24.7 → amber (<25) ✓

console.log('=== FIX 2: P2 Ball-Watching Drift Realism ===\n');

const P2_CAPTION = 'LD charges straight. Rest of the team ball-watches too.';
const OLD_LW = 'LW:{x:22,y:30}';
const NEW_LW = 'LW:{x:42,y:38}';

let p2Done = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(P2_CAPTION)) {
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes(OLD_LW)) {
        lines[j] = lines[j].replace(OLD_LW, NEW_LW);
        console.log(`  OK: LW (22,30) → (42,38)`);
        console.log(`  Drift from ph0 LW(31,41) after swap: sqrt(11²+3²) ≈ 11.4 ✓`);
        console.log(`  Coverage to o5(66,44): ≈24.7 → amber ✓`);
        p2Done = true;
        break;
      } else if (lines[j].includes(NEW_LW)) {
        console.log(`  Already applied: LW is already at (42,38). Skipping.`);
        p2Done = true;
        break;
      }
    }
    if (!p2Done) console.error(`  ERROR: neither old "${OLD_LW}" nor new "${NEW_LW}" found near P2 caption`);
    break;
  }
}
if (!p2Done && !lines.some(l => l.includes(P2_CAPTION))) {
  console.error('  ERROR: P2 caption not found');
}

console.log(`\nFIX 2 ${p2Done ? 'complete' : 'FAILED'}.\n`);

// ─── Write ────────────────────────────────────────────────────────────────────

const newContent = lines.join('\n');
if (newContent !== rawContent) {
  writeFileSync(TACTICS_FILE, newContent, 'utf8');
  console.log('tactics.js written.');
} else {
  console.log('No changes to tactics.js.');
}

console.log('\n=== Done ===');
