import { PLAYS } from './plays';
import { TACTICS } from './tactics';

export const CORE_PLAY_IDS = Object.freeze([
  'trap',
  'dzfl',
  'nfd',
  'bck',
  'pkb',
  'pomr',
  'brk',
  'zent',
  'slot-window',
  'lcl',
  'pts',
  'ppum',
]);

export const CORE_TACTIC_IDS = Object.freeze([
  'protect-the-middle',
  'watch-your-man',
  'gap-control',
  'instant-backcheck',
  'triangle-spacing',
  'cycling-the-boards',
]);

export const CURRICULUM_LANES = Object.freeze([
  Object.freeze({
    id: 'defence',
    label: 'Defence',
    shortLabel: 'Defence',
    description: 'Deny the middle, recover together, and win the next possession.',
  }),
  Object.freeze({
    id: 'offence',
    label: 'Offence',
    shortLabel: 'Offence',
    description: 'Create width, recognize openings, and turn advantages into chances.',
  }),
]);

const PLAY_CURRICULUM = Object.freeze({
  trap: Object.freeze({ lane: 'defence', situation: 'Primary system', priority: 1 }),
  dzfl: Object.freeze({ lane: 'defence', situation: 'Faceoff response', priority: 2 }),
  nfd: Object.freeze({ lane: 'defence', situation: 'Defensive zone', priority: 3 }),
  bck: Object.freeze({ lane: 'defence', situation: 'Turnover response', priority: 4 }),
  pkb: Object.freeze({ lane: 'defence', situation: 'Short-handed', priority: 5 }),
  pomr: Object.freeze({ lane: 'defence', situation: 'Rush prevention', priority: 6 }),
  brk: Object.freeze({ lane: 'offence', situation: 'Zone exit', priority: 1 }),
  zent: Object.freeze({ lane: 'offence', situation: 'Zone entry', priority: 2 }),
  'slot-window': Object.freeze({ lane: 'offence', situation: 'Chance creation', priority: 3 }),
  lcl: Object.freeze({ lane: 'offence', situation: 'Sustained pressure', priority: 4 }),
  pts: Object.freeze({ lane: 'offence', situation: 'Net-front finish', priority: 5 }),
  ppum: Object.freeze({ lane: 'offence', situation: 'Power play', priority: 6 }),
});

const TACTIC_CURRICULUM = Object.freeze({
  'protect-the-middle': Object.freeze({ lane: 'defence', situation: 'Primary system', priority: 1 }),
  'watch-your-man': Object.freeze({ lane: 'defence', situation: 'Coverage', priority: 2 }),
  'gap-control': Object.freeze({ lane: 'defence', situation: 'Entry defence', priority: 3 }),
  'instant-backcheck': Object.freeze({ lane: 'defence', situation: 'Turnover response', priority: 4 }),
  'triangle-spacing': Object.freeze({ lane: 'offence', situation: 'Support shape', priority: 1 }),
  'cycling-the-boards': Object.freeze({ lane: 'offence', situation: 'Create the slot', priority: 2 }),
});

const PLAY_NAME_OVERRIDES = Object.freeze({
  dzfl: 'D-Zone Faceoff',
  lcl: 'Low Cycle',
});

function selectById(source, ids, label) {
  return ids.map((id) => {
    const item = source.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`${label} catalog references missing id: ${id}`);
    return item;
  });
}

export const CORE_PLAYS = Object.freeze(
  selectById(PLAYS, CORE_PLAY_IDS, 'Play').map((play) => {
    const curriculum = PLAY_CURRICULUM[play.id];
    if (!curriculum) throw new Error(`Play curriculum metadata is missing for: ${play.id}`);
    return Object.freeze({
      ...play,
      ...curriculum,
      n: PLAY_NAME_OVERRIDES[play.id] ?? play.n,
      isPrimarySystem: play.id === 'trap',
    });
  }),
);

export const CORE_TACTICS = Object.freeze(
  selectById(TACTICS, CORE_TACTIC_IDS, 'Strategy').map((tactic) => {
    const curriculum = TACTIC_CURRICULUM[tactic.id];
    if (!curriculum) throw new Error(`Strategy curriculum metadata is missing for: ${tactic.id}`);
    const linkedPlays = tactic.id === 'cycling-the-boards'
      ? [...new Set([...tactic.linkedPlays, 'slot-window'])]
      : tactic.linkedPlays;
    return Object.freeze({
      ...tactic,
      ...curriculum,
      linkedPlays: Object.freeze(linkedPlays),
      isPrimarySystem: tactic.id === 'protect-the-middle',
    });
  }),
);

export const CORE_PLAY_ID_SET = new Set(CORE_PLAY_IDS);
export const CORE_TACTIC_ID_SET = new Set(CORE_TACTIC_IDS);

export const ARCHIVED_PLAY_IDS = Object.freeze(
  PLAYS.filter((play) => !CORE_PLAY_ID_SET.has(play.id)).map((play) => play.id),
);

export const ARCHIVED_TACTIC_IDS = Object.freeze(
  TACTICS.filter((tactic) => !CORE_TACTIC_ID_SET.has(tactic.id)).map((tactic) => tactic.id),
);

export function isCorePlayId(playId) {
  return CORE_PLAY_ID_SET.has(playId);
}

export function isCoreTacticId(tacticId) {
  return CORE_TACTIC_ID_SET.has(tacticId);
}

export function itemsForCurriculumLane(items, lane) {
  return items
    .filter((item) => item.lane === lane)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}
