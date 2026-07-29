const HIDDEN_TACTICAL_DETAIL = [
  /^CC_Base_(EyeOcclusion|TearLine|Teeth|Tongue)$/,
  /_Helmet_(EarPadding|TempleFastener|Vent_)/,
  /_Shoe_(Left|Right)_Laces$/,
  /_Glove_(Left|Right)_Backhand_Guards$/,
];

export function isTacticalDistanceMeshVisible(name = '') {
  return !HIDDEN_TACTICAL_DETAIL.some((pattern) => pattern.test(name));
}
