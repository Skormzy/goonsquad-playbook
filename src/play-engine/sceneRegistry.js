import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';
import { normalizeFaceoffOutcome, resolveFaceoffPlayOutcome } from '../data/faceoffPlays';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import {
  compilePlayThreeDScene,
  compileStrategyThreeDScene,
} from './compileThreeDScene';

const PLAY_SCENES = new Map(PLAYS.map((play) => [play.id, compilePlayThreeDScene(play)]));
PLAY_SCENES.set(standardBreakout3dReplay.sourcePlayId, standardBreakout3dReplay);

const LOST_FACEOFF_SCENES = new Map(
  PLAYS
    .filter((play) => play.faceoff)
    .map((play) => [play.id, compilePlayThreeDScene(resolveFaceoffPlayOutcome(play, 'lost'))]),
);

const STRATEGY_SCENES = new Map();
TACTICS.forEach((tactic) => {
  STRATEGY_SCENES.set(`${tactic.id}:mistake`, compileStrategyThreeDScene(tactic, 'mistake'));
  STRATEGY_SCENES.set(`${tactic.id}:correct`, compileStrategyThreeDScene(tactic, 'correct'));
});

export function getPlayScene(playId, requestedFaceoffOutcome = 'won') {
  if (normalizeFaceoffOutcome(requestedFaceoffOutcome) === 'lost' && LOST_FACEOFF_SCENES.has(playId)) {
    return LOST_FACEOFF_SCENES.get(playId);
  }
  return PLAY_SCENES.get(playId) ?? null;
}

export function hasPlayScene(playId, requestedFaceoffOutcome = 'won') {
  return getPlayScene(playId, requestedFaceoffOutcome) !== null;
}

export function getStrategyScene(tacticId, requestedVariant = 'correct') {
  const variant = requestedVariant === 'mistake' ? 'mistake' : 'correct';
  return STRATEGY_SCENES.get(`${tacticId}:${variant}`) ?? null;
}

export function hasStrategyScene(tacticId, requestedVariant = 'correct') {
  return getStrategyScene(tacticId, requestedVariant) !== null;
}

export function getRegisteredPlayScenes() {
  return [...PLAY_SCENES.values()];
}

export function getRegisteredFaceoffOutcomeScenes() {
  return PLAYS
    .filter((play) => play.faceoff)
    .flatMap((play) => [getPlayScene(play.id, 'won'), getPlayScene(play.id, 'lost')]);
}

export function getRegisteredStrategyScenes() {
  return [...STRATEGY_SCENES.values()];
}
