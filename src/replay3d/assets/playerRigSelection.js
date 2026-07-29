import { HAS_FULL_PRODUCTION_RIG_SET, HAS_RUNNER_PRODUCTION_RIG_SET, PLAYER_RIG_AVAILABILITY } from './generatedPlayerRigAvailability';
import { PLAYER_RIG_ASSETS } from './playerRigManifest';

export function getProductionRigKey(player) {
  const side = player.team === 'us' ? 'Home' : 'Away';
  return player.role === 'G' ? `goalie${side}` : `runner${side}`;
}

export function getPlayerRigAsset(player) {
  const productionKey = getProductionRigKey(player);
  const productionAsset = PLAYER_RIG_AVAILABILITY.production[productionKey];
  const isGoalie = player.role === 'G';

  if (productionAsset?.available) {
    return {
      mode: 'production',
      key: productionKey,
      url: productionAsset.url,
      clips: productionAsset.clips,
      retargetMotionQuality: productionAsset.retargetMotionQuality,
      isFinalGradeMotion: productionAsset.isFinalGradeMotion,
      requiresPoseCorrection: !isGoalie && productionAsset.retargetMotionQuality !== 'final-grade-motion',
      finalGradeClips: productionAsset.finalGradeClips,
      missingFinalGradeClips: productionAsset.missingFinalGradeClips,
    };
  }

  if (!isGoalie) {
    return {
      mode: 'bridge',
      key: 'detailedBridgeRunner',
      url: PLAYER_RIG_ASSETS.detailedRunner.url,
      animationSource: PLAYER_RIG_ASSETS.detailedRunner.animationSource,
      sourcePrefix: PLAYER_RIG_ASSETS.detailedRunner.sourcePrefix,
      overlay: 'fullRunner',
      clips: ['Idle', 'Walk', 'Run'],
    };
  }

  return {
    mode: 'bridge',
    key: 'bridgeGoalie',
    url: PLAYER_RIG_ASSETS.temporaryRunner.url,
    animationSource: PLAYER_RIG_ASSETS.temporaryRunner.url,
    sourcePrefix: PLAYER_RIG_ASSETS.temporaryRunner.sourcePrefix,
    positionY: 0.02,
    overlay: 'goalie',
    clips: PLAYER_RIG_ASSETS.temporaryRunner.clips,
  };
}

export function getAvailableProductionRigUrls() {
  return Object.values(PLAYER_RIG_AVAILABILITY.production)
    .filter((asset) => asset.available)
    .map((asset) => asset.url);
}

export function isUsingProductionRigs() {
  return HAS_FULL_PRODUCTION_RIG_SET;
}

export function isUsingProductionRunnerRigs() {
  return HAS_RUNNER_PRODUCTION_RIG_SET;
}
