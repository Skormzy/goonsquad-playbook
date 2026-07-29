export const VNEXT_3D_RELEASE = Object.freeze({
  acceptedForPublicRuntime: true,
  status: 'released',
  rejectedRuntime: 'legacy-generated-athlete',
  rejectionReason: 'The previous athlete runtime failed visual review for anatomy, equipment, movement, stick contact, and foot contact.',
  releaseReason: 'The accepted tactical-distance runtime passed 12-player, motion, navigation, desktop, mobile, and public-build gates.',
});

export const VNEXT_3D_GATES = Object.freeze([
  Object.freeze({ id: 'athlete', label: 'Production athlete', status: 'accepted', statusLabel: 'BASE ACCEPTED' }),
  Object.freeze({ id: 'equipment', label: 'Authored equipment', status: 'accepted', statusLabel: 'AUTHORED' }),
  Object.freeze({ id: 'movement', label: 'Movement and contact', status: 'accepted', statusLabel: 'CONTACT LOCKED' }),
  Object.freeze({ id: 'replay', label: '12-player replay', status: 'accepted', statusLabel: 'PUBLIC' }),
]);

export function canRenderVNext3D() {
  return VNEXT_3D_RELEASE.acceptedForPublicRuntime;
}
