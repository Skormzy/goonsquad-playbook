import { describe, expect, it } from 'vitest';
import { CORE_PLAYS, CORE_PLAY_IDS, CORE_TACTICS, CORE_TACTIC_IDS } from './coreCatalog';
import {
  CORE_PLAY_SYSTEM_FITS,
  CORE_TACTIC_SYSTEM_FITS,
  TEAM_SYSTEM_NON_NEGOTIABLES,
} from './teamSystem';

function opponentCarrier(phase) {
  return phase.opp.find((player) => (
    player.id === phase.ballOwner || player.hasBall
  ));
}

function expectInsideAndGoalSide(defender, carrier) {
  expect(defender.y).toBeLessThan(carrier.y);
  if (carrier.x <= 45) expect(defender.x).toBeGreaterThan(carrier.x);
  if (carrier.x >= 55) expect(defender.x).toBeLessThan(carrier.x);
}

describe('coach system integrity', () => {
  it('maps every active play and strategy to an explicit game state and purpose', () => {
    expect(Object.keys(CORE_PLAY_SYSTEM_FITS).sort()).toEqual([...CORE_PLAY_IDS].sort());
    expect(Object.keys(CORE_TACTIC_SYSTEM_FITS).sort()).toEqual([...CORE_TACTIC_IDS].sort());

    Object.values(CORE_PLAY_SYSTEM_FITS).forEach((fit) => {
      expect(fit.states.length).toBeGreaterThan(0);
      expect(fit.purpose.length).toBeGreaterThan(12);
    });
    Object.values(CORE_TACTIC_SYSTEM_FITS).forEach((fit) => {
      expect(fit.states.length).toBeGreaterThan(0);
      expect(fit.purpose.length).toBeGreaterThan(12);
    });
    expect(TEAM_SYSTEM_NON_NEGOTIABLES).toHaveLength(7);
  });

  it('does not teach a blanket two-forwards-deep rule anywhere in the active curriculum', () => {
    const activeCurriculum = JSON.stringify({ plays: CORE_PLAYS, tactics: CORE_TACTICS });
    expect(activeCurriculum).not.toMatch(
      /\b(?:only\s+)?(?:2|two)\s+forwards?\s+(?:go|going)\s+deep\b/i,
    );
  });

  it('makes F3 depth a prerequisite for a defender stepping down', () => {
    const safetyPlay = CORE_PLAYS.find((play) => play.id === 'pomr');
    expect(safetyPlay.n).toBe('F3 High - Turnover Safety');
    expect(safetyPlay.phases.map((phase) => phase.systemState)).toEqual([
      'secure-possession',
      'secure-possession',
      'opponent-control',
      'opponent-control',
    ]);

    safetyPlay.phases
      .filter((phase) => phase.systemState === 'secure-possession')
      .forEach((phase) => {
        const highForward = phase.pos[phase.highForwardRole];
        const lowForwards = ['LW', 'C', 'RW']
          .filter((role) => role !== phase.highForwardRole)
          .map((role) => phase.pos[role]);
        expect(highForward.y).toBeLessThanOrEqual(
          Math.min(...lowForwards.map((player) => player.y)) - 8,
        );
      });

    const pinchPhase = safetyPlay.phases.find((phase) => phase.pinchingRole);
    expect(pinchPhase.pos[pinchPhase.highForwardRole].y)
      .toBeLessThan(pinchPhase.pos[pinchPhase.pinchingRole].y);
    expect(pinchPhase.pos[pinchPhase.weakSideDefenseRole].y)
      .toBeLessThan(pinchPhase.pos[pinchPhase.pinchingRole].y);
  });

  it('recovers every opponent-control safety phase into an inside, goal-side 1-2-2', () => {
    const safetyPlay = CORE_PLAYS.find((play) => play.id === 'pomr');
    safetyPlay.phases
      .filter((phase) => phase.systemState === 'opponent-control')
      .forEach((phase) => {
        const carrier = opponentCarrier(phase);
        expect(phase.coverage[phase.pressureRole]).toBe(carrier.id);
        expectInsideAndGoalSide(phase.pos[phase.pressureRole], carrier);
        expect(phase.pos.C.y).toBeLessThan(carrier.y);
        expect(phase.pos[phase.highForwardRole ?? 'RW'].y).toBeLessThan(carrier.y);
        expect(Math.max(phase.pos.LD.y, phase.pos.RD.y))
          .toBeLessThan(Math.min(phase.pos.C.y, phase.pos.RW.y));
      });
  });

  it('ends the backcheck in the same three defensive layers as the primary system', () => {
    const backcheck = CORE_PLAYS.find((play) => play.id === 'bck');
    const finalPhase = backcheck.phases.at(-1);
    const carrier = opponentCarrier(finalPhase);

    expect(finalPhase.systemState).toBe('opponent-control');
    expect(finalPhase.pressureRole).toBe('RW');
    expectInsideAndGoalSide(finalPhase.pos.RW, carrier);
    expect(Math.max(finalPhase.pos.LD.y, finalPhase.pos.RD.y))
      .toBeLessThan(Math.min(finalPhase.pos.C.y, finalPhase.pos.LW.y));
  });

  it('uses house-first exchanges after a wide entry instead of chasing matchups', () => {
    const netFront = CORE_PLAYS.find((play) => play.id === 'nfd');
    expect(netFront.phases.every((phase) => phase.systemState === 'defensive-zone')).toBe(true);

    netFront.phases.forEach((phase) => {
      const carrier = opponentCarrier(phase);
      expect(phase.coverage[phase.pressureRole]).toBe(carrier.id);
      expectInsideAndGoalSide(phase.pos[phase.pressureRole], carrier);
    });

    expect(netFront.phases.map((phase) => phase.pressureRole)).toEqual(['LD', 'LD', 'RD']);
  });

  it('uses compatible language for coverage, gaps, entries, and turnover recovery', () => {
    expect(CORE_TACTICS.find((tactic) => tactic.id === 'watch-your-man')?.title)
      .toBe('Protect the House, Track Your Check');
    expect(CORE_TACTICS.find((tactic) => tactic.id === 'gap-control')?.subtitle)
      .toContain('support determines the gap');
    expect(CORE_TACTICS.find((tactic) => tactic.id === 'instant-backcheck')?.title)
      .toBe('Instant Recovery to the 1-2-2');

    const entry = CORE_PLAYS.find((play) => play.id === 'zent');
    expect(entry.desc).toContain('Enter with support');
    expect(entry.strat).toContain('Place the ball behind pressure only when');
  });
});
