import { COURT_LENGTH_METERS, COURT_WIDTH_METERS } from '../play-engine/movementMetrics';

export const PRODUCTION_COURT_MARKINGS = Object.freeze({
  widthMeters: COURT_WIDTH_METERS,
  lengthMeters: COURT_LENGTH_METERS,
  cornerRadiusMeters: 3.8,
  zoneLineZ: COURT_LENGTH_METERS * 0.18,
  goalLineZ: COURT_LENGTH_METERS * 0.44,
  faceoffX: COURT_WIDTH_METERS * 0.23,
  faceoffZ: COURT_LENGTH_METERS * 0.30,
  neutralFaceoffZ: COURT_LENGTH_METERS * 0.18 - 1.5,
  faceoffCircleRadius: 2.8,
  centerCircleRadius: 2.5,
  creaseRadius: 2.05,
});

export function neutralFaceoffDots() {
  const { faceoffX, neutralFaceoffZ } = PRODUCTION_COURT_MARKINGS;
  return [-1, 1].flatMap((xSign) => [-1, 1].map((zSign) => ({
    x: xSign * faceoffX,
    z: zSign * neutralFaceoffZ,
  })));
}
