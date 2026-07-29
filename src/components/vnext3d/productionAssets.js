import fieldHomeUrl from '../../assets/vnext3d/field-home.glb?url';
import fieldAwayUrl from '../../assets/vnext3d/field-away.glb?url';
import goalieHomeUrl from '../../assets/vnext3d/goalie-home.glb?url';
import goalieAwayUrl from '../../assets/vnext3d/goalie-away.glb?url';
import cmuSprintHomeUrl from '../../assets/vnext3d-review/field-home-cmu-sprint.glb?url';
import cmuSprintAwayUrl from '../../assets/vnext3d-review/field-away-cmu-sprint.glb?url';
import cmuRunHomeUrl from '../../assets/vnext3d-review/field-home-cmu-run.glb?url';
import cmuRunAwayUrl from '../../assets/vnext3d-review/field-away-cmu-run.glb?url';
import cmu16RunHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-run.glb?url';
import cmu16RunAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-run.glb?url';
import cmu16IkTransitionHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-transition.glb?url';
import cmu16IkTransitionAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-transition.glb?url';
import cmu16IkUniformHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-uniform.glb?url';
import cmu16IkUniformAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-uniform.glb?url';
import cmu16IkRedSleeveHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-red-sleeve.glb?url';
import cmu16IkRedSleeveAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-red-sleeve.glb?url';
import cmu16IkContinuousJerseyHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-continuous-jersey.glb?url';
import cmu16IkContinuousJerseyAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-continuous-jersey.glb?url';
import cmu16IkUpperBodyHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-upper-body.glb?url';
import cmu16IkUpperBodyAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-upper-body.glb?url';
import cmu16IkOpenFaceHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-open-face.glb?url';
import cmu16IkOpenFaceAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-open-face.glb?url';
import cmu16IkNaturalGripHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-natural-grip.glb?url';
import cmu16IkNaturalGripAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-natural-grip.glb?url';
import cmu16IkDiagonalStickHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-diagonal-stick.glb?url';
import cmu16IkDiagonalStickAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-diagonal-stick.glb?url';
import cmu16IkPbrHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-pbr.glb?url';
import cmu16IkPbrAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-pbr.glb?url';
import cmu16IkSilhouetteHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-silhouette.glb?url';
import cmu16IkSilhouetteAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-silhouette.glb?url';
import cmu16IkTailoredUniformHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-tailored-uniform.glb?url';
import cmu16IkTailoredUniformAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-tailored-uniform.glb?url';
import cmu16IkClothDrapeHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-cloth-drape.glb?url';
import cmu16IkClothDrapeAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-cloth-drape.glb?url';
import cmu16IkHelmetDetailHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-helmet-detail.glb?url';
import cmu16IkHelmetDetailAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-helmet-detail.glb?url';
import cmu16IkFacePoseHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-face-pose.glb?url';
import cmu16IkFacePoseAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-face-pose.glb?url';
import cmu16IkNeckBoundaryHomeUrl from '../../assets/vnext3d-review/field-home-cmu16-ik-neck-boundary.glb?url';
import cmu16IkNeckBoundaryAwayUrl from '../../assets/vnext3d-review/field-away-cmu16-ik-neck-boundary.glb?url';

export const PRODUCTION_ATHLETE_ASSETS = Object.freeze({
  'field-home': fieldHomeUrl,
  'field-away': fieldAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
});

export const PRIVATE_MOTION_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmuSprintHomeUrl,
  'field-away': cmuSprintAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CAPTURED_RUN_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmuRunHomeUrl,
  'field-away': cmuRunAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_RUN_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16RunHomeUrl,
  'field-away': cmu16RunAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_TRANSITION_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkTransitionHomeUrl,
  'field-away': cmu16IkTransitionAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_UNIFORM_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkUniformHomeUrl,
  'field-away': cmu16IkUniformAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_RED_SLEEVE_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkRedSleeveHomeUrl,
  'field-away': cmu16IkRedSleeveAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_CONTINUOUS_JERSEY_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkContinuousJerseyHomeUrl,
  'field-away': cmu16IkContinuousJerseyAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_UPPER_BODY_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkUpperBodyHomeUrl,
  'field-away': cmu16IkUpperBodyAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_OPEN_FACE_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkOpenFaceHomeUrl,
  'field-away': cmu16IkOpenFaceAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_NATURAL_GRIP_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkNaturalGripHomeUrl,
  'field-away': cmu16IkNaturalGripAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_DIAGONAL_STICK_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkDiagonalStickHomeUrl,
  'field-away': cmu16IkDiagonalStickAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_PBR_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkPbrHomeUrl,
  'field-away': cmu16IkPbrAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_SILHOUETTE_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkSilhouetteHomeUrl,
  'field-away': cmu16IkSilhouetteAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_TAILORED_UNIFORM_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkTailoredUniformHomeUrl,
  'field-away': cmu16IkTailoredUniformAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_CLOTH_DRAPE_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkClothDrapeHomeUrl,
  'field-away': cmu16IkClothDrapeAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_HELMET_DETAIL_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkHelmetDetailHomeUrl,
  'field-away': cmu16IkHelmetDetailAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_FACE_POSE_REVIEW_ASSETS = import.meta.env.DEV ? Object.freeze({
  'field-home': cmu16IkFacePoseHomeUrl,
  'field-away': cmu16IkFacePoseAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
}) : null;

export const PRIVATE_CMU16_IK_NECK_BOUNDARY_REVIEW_ASSETS = Object.freeze({
  'field-home': cmu16IkNeckBoundaryHomeUrl,
  'field-away': cmu16IkNeckBoundaryAwayUrl,
  'goalie-home': goalieHomeUrl,
  'goalie-away': goalieAwayUrl,
});

// The complete replay uses this package at tactical viewing distances while
// later character-detail experiments remain explicit opt-in reviews.
export const TACTICAL_DISTANCE_BASELINE_ID = 'cmu-jog16-ik-neck-boundary';

export function athleteAssetsForMotionReview(reviewId) {
  if (reviewId === 'cmu-jog16-ik-neck-boundary') {
    return PRIVATE_CMU16_IK_NECK_BOUNDARY_REVIEW_ASSETS;
  }
  // Candidate models are local review tools. Public builds always resolve to
  // the accepted tactical-distance package so experiments cannot leak into the app.
  if (!import.meta.env.DEV) return PRIVATE_CMU16_IK_NECK_BOUNDARY_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-face-pose') {
    return PRIVATE_CMU16_IK_FACE_POSE_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-helmet-detail') {
    return PRIVATE_CMU16_IK_HELMET_DETAIL_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-cloth-drape') {
    return PRIVATE_CMU16_IK_CLOTH_DRAPE_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-tailored-uniform') {
    return PRIVATE_CMU16_IK_TAILORED_UNIFORM_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-silhouette') {
    return PRIVATE_CMU16_IK_SILHOUETTE_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-pbr') {
    return PRIVATE_CMU16_IK_PBR_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-diagonal-stick') {
    return PRIVATE_CMU16_IK_DIAGONAL_STICK_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-natural-grip') {
    return PRIVATE_CMU16_IK_NATURAL_GRIP_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-open-face') {
    return PRIVATE_CMU16_IK_OPEN_FACE_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-upper-body') {
    return PRIVATE_CMU16_IK_UPPER_BODY_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-continuous-jersey') {
    return PRIVATE_CMU16_IK_CONTINUOUS_JERSEY_REVIEW_ASSETS;
  }
  if (reviewId === 'cmu-jog16-ik-red-sleeve') return PRIVATE_CMU16_IK_RED_SLEEVE_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik-uniform') return PRIVATE_CMU16_IK_UNIFORM_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16-ik') return PRIVATE_CMU16_IK_TRANSITION_REVIEW_ASSETS;
  if (reviewId === 'cmu-jog16') return PRIVATE_CMU16_RUN_REVIEW_ASSETS;
  if (reviewId === 'cmu-run') return PRIVATE_CAPTURED_RUN_REVIEW_ASSETS;
  if (reviewId === 'cmu-sprint') return PRIVATE_MOTION_REVIEW_ASSETS;
  return PRODUCTION_ATHLETE_ASSETS;
}
