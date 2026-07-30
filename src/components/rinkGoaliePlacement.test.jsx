import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';

const rinkSource = readFileSync(new URL('./RinkSVG.jsx', import.meta.url), 'utf8');

function opponentGoalies(phase) {
  return (phase.opp ?? []).filter((player) => (
    player.isGoalie
    || player.l === 'G'
    || player.label === 'G'
  ));
}

const authoredPhases = [
  ...PLAYS.flatMap((play) => (
    play.phases.map((phase) => ({
      id: `play:${play.id}:${phase.id}`,
      phase,
    }))
  )),
  ...TACTICS.flatMap((tactic) => (
    ['mistakeScene', 'correctScene'].flatMap((sceneKey) => (
      (tactic[sceneKey]?.phases ?? []).map((phase, index) => ({
        id: `strategy:${tactic.id}:${sceneKey}:${index}`,
        phase,
      }))
    ))
  )),
];

describe('shared 2D goalie placement', () => {
  it('positions animated goalie groups once around local marker geometry', () => {
    expect(rinkSource).toContain('function GoalieMarker');
    expect(rinkSource).toContain('data-testid={`rink-goalie-${team}`}');
    expect(rinkSource).toContain('<MotionG');
    expect(rinkSource).toContain('animate={{ x, y }}');
    expect(rinkSource).toContain('x={-14}');
    expect(rinkSource).not.toContain('const MotionRect = motion.rect');
    expect(rinkSource).not.toMatch(/<MotionRect[\s\S]*?x=\{ox -/);
  });

  it('keeps exactly one opponent goalie in the top crease for every authored phase', () => {
    expect(authoredPhases.length).toBeGreaterThan(0);

    authoredPhases.forEach(({ id, phase }) => {
      const goalies = opponentGoalies(phase);
      expect(goalies, id).toHaveLength(1);
      expect(goalies[0].x, id).toBeGreaterThanOrEqual(40);
      expect(goalies[0].x, id).toBeLessThanOrEqual(60);
      expect(goalies[0].y, id).toBeGreaterThanOrEqual(89);
      expect(goalies[0].y, id).toBeLessThanOrEqual(94);
    });
  });
});
