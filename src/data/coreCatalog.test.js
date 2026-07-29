import { describe, expect, it } from 'vitest';
import { PLAYS } from './plays';
import { TACTICS } from './tactics';
import {
  ARCHIVED_PLAY_IDS,
  ARCHIVED_TACTIC_IDS,
  CORE_PLAY_IDS,
  CORE_PLAYS,
  CORE_TACTIC_IDS,
  CORE_TACTICS,
  itemsForCurriculumLane,
  isCorePlayId,
  isCoreTacticId,
} from './coreCatalog';

describe('curated core curriculum', () => {
  it('limits the active experience to 12 distinct plays and 6 strategies', () => {
    expect(CORE_PLAYS).toHaveLength(12);
    expect(CORE_TACTICS).toHaveLength(6);
    expect(new Set(CORE_PLAY_IDS).size).toBe(CORE_PLAY_IDS.length);
    expect(new Set(CORE_TACTIC_IDS).size).toBe(CORE_TACTIC_IDS.length);
    expect(ARCHIVED_PLAY_IDS).toHaveLength(PLAYS.length - CORE_PLAYS.length);
    expect(ARCHIVED_TACTIC_IDS).toHaveLength(TACTICS.length - CORE_TACTICS.length);
  });

  it('covers every game context without mirrored or numerical variant clutter', () => {
    expect(new Set(CORE_PLAYS.map((play) => play.cat))).toEqual(new Set([
      'defensive',
      'neutral',
      'offensive',
      'special',
      'transition',
      'systems',
    ]));
    expect(CORE_PLAY_IDS).not.toContain('dzfr');
    expect(CORE_PLAY_IDS).not.toContain('ozfl');
    expect(CORE_PLAY_IDS).not.toContain('d32');
    expect(CORE_PLAY_IDS).not.toContain('o32');
    expect(CORE_PLAYS.find((play) => play.id === 'dzfl')?.n).toBe('D-Zone Faceoff');
    expect(CORE_PLAYS.find((play) => play.id === 'lcl')?.n).toBe('Low Cycle');
  });

  it('presents a balanced offence and defence curriculum led by the team system', () => {
    const defence = itemsForCurriculumLane(CORE_PLAYS, 'defence');
    const offence = itemsForCurriculumLane(CORE_PLAYS, 'offence');
    const defensivePrinciples = itemsForCurriculumLane(CORE_TACTICS, 'defence');
    const offensivePrinciples = itemsForCurriculumLane(CORE_TACTICS, 'offence');

    expect(defence).toHaveLength(6);
    expect(offence).toHaveLength(6);
    expect(defensivePrinciples).toHaveLength(4);
    expect(offensivePrinciples).toHaveLength(2);
    expect(defence[0]).toMatchObject({
      id: 'trap',
      n: '1-2-2 Strong-Side Lock',
      isPrimarySystem: true,
    });
    expect(offence.map((play) => play.id)).toContain('slot-window');
    expect(defensivePrinciples[0]).toMatchObject({
      id: 'protect-the-middle',
      title: '1-2-2 Strong-Side Lock',
      isPrimarySystem: true,
    });
  });

  it('keeps every core strategy connected to at least one surviving play', () => {
    CORE_TACTICS.forEach((tactic) => {
      expect(tactic.linkedPlays.some(isCorePlayId), tactic.id).toBe(true);
    });
  });

  it('preserves every archived item in the authored source library', () => {
    expect([...CORE_PLAY_IDS, ...ARCHIVED_PLAY_IDS].sort()).toEqual(PLAYS.map((play) => play.id).sort());
    expect([...CORE_TACTIC_IDS, ...ARCHIVED_TACTIC_IDS].sort()).toEqual(TACTICS.map((tactic) => tactic.id).sort());
    ARCHIVED_PLAY_IDS.forEach((id) => expect(isCorePlayId(id)).toBe(false));
    ARCHIVED_TACTIC_IDS.forEach((id) => expect(isCoreTacticId(id)).toBe(false));
  });
});
