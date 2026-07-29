import { ACCEPTED_ATHLETE_ASSETS } from './acceptedAthleteAssets';

export const PRODUCTION_ATHLETE_ASSETS = Object.freeze({
  'field-home': ACCEPTED_ATHLETE_ASSETS['field-home'],
  'field-away': ACCEPTED_ATHLETE_ASSETS['field-away'],
  'goalie-home': ACCEPTED_ATHLETE_ASSETS['goalie-home'],
  'goalie-away': ACCEPTED_ATHLETE_ASSETS['goalie-away'],
});

function localReviewAssets(reviewName) {
  if (!import.meta.env.DEV) return ACCEPTED_ATHLETE_ASSETS;

  return Object.freeze({
    'field-home': `/src/assets/vnext3d-review/field-home-${reviewName}.glb`,
    'field-away': `/src/assets/vnext3d-review/field-away-${reviewName}.glb`,
    'goalie-home': ACCEPTED_ATHLETE_ASSETS['goalie-home'],
    'goalie-away': ACCEPTED_ATHLETE_ASSETS['goalie-away'],
  });
}

export const PRIVATE_MOTION_REVIEW_ASSETS = localReviewAssets('cmu-sprint');
export const PRIVATE_CAPTURED_RUN_REVIEW_ASSETS = localReviewAssets('cmu-run');
export const PRIVATE_CMU16_RUN_REVIEW_ASSETS = localReviewAssets('cmu16-run');
export const PRIVATE_CMU16_IK_TRANSITION_REVIEW_ASSETS = localReviewAssets('cmu16-ik-transition');
export const PRIVATE_CMU16_IK_UNIFORM_REVIEW_ASSETS = localReviewAssets('cmu16-ik-uniform');
export const PRIVATE_CMU16_IK_RED_SLEEVE_REVIEW_ASSETS = localReviewAssets('cmu16-ik-red-sleeve');
export const PRIVATE_CMU16_IK_CONTINUOUS_JERSEY_REVIEW_ASSETS = localReviewAssets('cmu16-ik-continuous-jersey');
export const PRIVATE_CMU16_IK_UPPER_BODY_REVIEW_ASSETS = localReviewAssets('cmu16-ik-upper-body');
export const PRIVATE_CMU16_IK_OPEN_FACE_REVIEW_ASSETS = localReviewAssets('cmu16-ik-open-face');
export const PRIVATE_CMU16_IK_NATURAL_GRIP_REVIEW_ASSETS = localReviewAssets('cmu16-ik-natural-grip');
export const PRIVATE_CMU16_IK_DIAGONAL_STICK_REVIEW_ASSETS = localReviewAssets('cmu16-ik-diagonal-stick');
export const PRIVATE_CMU16_IK_PBR_REVIEW_ASSETS = localReviewAssets('cmu16-ik-pbr');
export const PRIVATE_CMU16_IK_SILHOUETTE_REVIEW_ASSETS = localReviewAssets('cmu16-ik-silhouette');
export const PRIVATE_CMU16_IK_TAILORED_UNIFORM_REVIEW_ASSETS = localReviewAssets('cmu16-ik-tailored-uniform');
export const PRIVATE_CMU16_IK_CLOTH_DRAPE_REVIEW_ASSETS = localReviewAssets('cmu16-ik-cloth-drape');
export const PRIVATE_CMU16_IK_HELMET_DETAIL_REVIEW_ASSETS = localReviewAssets('cmu16-ik-helmet-detail');
export const PRIVATE_CMU16_IK_FACE_POSE_REVIEW_ASSETS = localReviewAssets('cmu16-ik-face-pose');
export const PRIVATE_CMU16_IK_NECK_BOUNDARY_REVIEW_ASSETS = ACCEPTED_ATHLETE_ASSETS;

// The complete replay uses this package at tactical viewing distances while
// later character-detail experiments remain explicit local reviews.
export const TACTICAL_DISTANCE_BASELINE_ID = 'cmu-jog16-ik-neck-boundary';

export function athleteAssetsForMotionReview(reviewId) {
  if (!import.meta.env.DEV) return ACCEPTED_ATHLETE_ASSETS;
  if (reviewId === 'cmu-jog16-ik-neck-boundary') return ACCEPTED_ATHLETE_ASSETS;
  if (reviewId === 'cmu-jog16-ik-face-pose') return PRIVATE_CMU16_IK_FACE_POSE_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-helmet-detail') return PRIVATE_CMU16_IK_HELMET_DETAIL_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-cloth-drape') return PRIVATE_CMU16_IK_CLOTH_DRAPE_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-tailored-uniform') return PRIVATE_CMU16_IK_TAILORED_UNIFORM_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-silhouette') return PRIVATE_CMU16_IK_SILHOUETTE_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-pbr') return PRIVATE_CMU16_IK_PBR_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-diagonal-stick') return PRIVATE_CMU16_IK_DIAGONAL_STICK_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-natural-grip') return PRIVATE_CMU16_IK_NATURAL_GRIP_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-open-face') return PRIVATE_CMU16_IK_OPEN_FACE_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-upper-body') return PRIVATE_CMU16_IK_UPPER_BODY_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-continuous-jersey') return PRIVATE_CMU16_IK_CONTINUOUS_JERSEY_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-red-sleeve') return PRIVATE_CMU16_IK_RED_SLEEVE_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-uniform') return PRIVATE_CMU16_IK_UNIFORM_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik') return PRIVATE_CMU16_IK_TRANSITION_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16') return PRIVATE_CMU16_RUN_REVIEW_ASSETS;
  if (reviewId === 'cmu-run') return PRIVATE_CAPTURED_RUN_REVIEW_ASSETS;
  if (reviewId === 'cmu-sprint') return PRIVATE_MOTION_REVIEW_ASSETS;
  return PRODUCTION_ATHLETE_ASSETS;
}
