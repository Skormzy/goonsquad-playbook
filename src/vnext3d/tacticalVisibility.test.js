import { describe, expect, it } from 'vitest';
import { isTacticalDistanceMeshVisible } from './tacticalVisibility';

describe('tactical-distance mesh visibility', () => {
  it('keeps the silhouette, identity, eyes, equipment, and stick readable', () => {
    for (const name of [
      'CC_Base_Body',
      'CC_Base_Eye',
      'GS_Home_Helmet_Shell',
      'GS_Home_Jersey',
      'GS_Home_Jersey_Back_Number_17',
      'GS_Home_Glove_Left',
      'GS_Home_Shoe_Left_Upper',
      'GS_Home_Stick_Shaft',
      'GS_Goalie_Home_Leg_Pad_Left',
      'GS_Goalie_Home_Mask_Cage_01',
    ]) expect(isTacticalDistanceMeshVisible(name), name).toBe(true);
  });

  it('removes only sub-pixel face and equipment detail from the full-court replay', () => {
    for (const name of [
      'CC_Base_EyeOcclusion',
      'CC_Base_TearLine',
      'CC_Base_Teeth',
      'CC_Base_Tongue',
      'GS_Home_Helmet_EarPadding_Left',
      'GS_Home_Helmet_TempleFastener_Right',
      'GS_Home_Helmet_Vent_Crown_Left',
      'GS_Home_Shoe_Right_Laces',
      'GS_Home_Glove_Left_Backhand_Guards',
    ]) expect(isTacticalDistanceMeshVisible(name), name).toBe(false);
  });
});
