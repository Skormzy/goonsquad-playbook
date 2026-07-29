import { describe, expect, it } from 'vitest';
import { TACTICS } from './tactics';

function tactic(id) {
  const match = TACTICS.find((entry) => entry.id === id);
  expect(match, `strategy ${id}`).toBeDefined();
  return match;
}

function opponentAt(phase, id) {
  return phase.opp.find((player) => player.id === id);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const projection = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared));
  const closest = {
    x: start.x + projection * dx,
    y: start.y + projection * dy,
  };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

describe('bounded strategy tactical corrections', () => {
  it('keeps weak-side safety behind every late gap-control challenge', () => {
    const phases = tactic('gap-control').correctScene.phases.slice(1);

    phases.forEach((phase) => {
      expect(phase.our.RD.y).toBeLessThan(phase.our.LD.y);
      expect(phase.caption.toLowerCase()).toMatch(/safety|behind|underneath/);
    });
  });

  it('preserves three connected layers in the late instant backcheck', () => {
    const phases = tactic('instant-backcheck').correctScene.phases.slice(2);

    phases.forEach((phase) => {
      expect(Math.min(phase.our.LW.y, phase.our.RW.y)).toBeGreaterThan(phase.our.C.y);
      expect(phase.our.C.y).toBeGreaterThan(
        Math.max(phase.our.LD.y, phase.our.RD.y),
      );
    });
  });

  it('authors a real wall cycle handoff followed by a cutter and finish', () => {
    const phases = tactic('cycling-the-boards').correctScene.phases;
    const wallCarrier = phases[1];
    const exchange = phases[2];
    const finish = phases[3];

    expect(wallCarrier.our.C.ball).toBe(true);
    expect(exchange.our.LW.ball).toBe(true);
    expect(exchange.ballPath[0]).toEqual(wallCarrier.ball);
    expect(exchange.ballPath.at(-1)).toEqual(exchange.ball);
    expect(exchange.our.C.y).toBeGreaterThan(wallCarrier.our.C.y);
    expect(exchange.caption.toLowerCase()).toContain('cuts');
    expect(finish.arrows.map((arrow) => arrow.type)).toEqual(['pass', 'shot']);
    expect(finish.ballPath.at(-1)).toEqual(finish.ball);
  });

  it('shows the crossing and changes assignments before the switch completes', () => {
    const phases = tactic('communication-defense').correctScene.phases;
    const setup = phases[0];
    const crossing = phases[1];

    expect(opponentAt(setup, 'o1').x).toBeLessThan(opponentAt(setup, 'o2').x);
    expect(opponentAt(crossing, 'o1').x).toBeGreaterThan(opponentAt(crossing, 'o2').x);
    expect(setup.coverage).toMatchObject({ LD: 'o1', C: 'o2' });
    expect(crossing.coverage).toMatchObject({ C: 'o1', LD: 'o2' });
    expect(crossing.ballPath.at(-1)).toEqual(crossing.ball);
  });

  it('only calls the moving-window lane available when defenders have cleared it', () => {
    const phases = tactic('never-stop-moving').correctScene.phases;
    expect(phases.map((phase) => phase.caption).join(' ')).not.toMatch(/\bopen\b/i);

    phases
      .filter((phase) => phase.caption.toLowerCase().includes('window'))
      .forEach((phase) => {
        const laneStart = phase.our.LW;
        const laneEnd = phase.our.RW;
        const nearestDefender = Math.min(...phase.opp
          .filter((player) => !player.isGoalie)
          .map((player) => distanceToSegment(player, laneStart, laneEnd)));
        expect(nearestDefender).toBeGreaterThanOrEqual(5);
      });
  });

  it('releases 1-2-2 matchup lines as soon as possession is won', () => {
    const phases = tactic('protect-the-middle').correctScene.phases;
    const pressurePhase = phases.at(-2);
    const possessionPhase = phases.at(-1);

    expect(Object.keys(pressurePhase.coverage)).toHaveLength(5);
    expect(possessionPhase.our.LW.ball).toBe(true);
    expect(possessionPhase.coverage).toEqual({});
  });
});
