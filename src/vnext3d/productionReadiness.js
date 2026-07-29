export const VNEXT_3D_RELEASE = Object.freeze({
  acceptedForPublicRuntime: false,
  status: 'rebuild',
  rejectedRuntime: 'legacy-generated-athlete',
  rejectionReason: 'The previous athlete runtime failed visual review for anatomy, equipment, movement, stick contact, and foot contact.',
});

export const VNEXT_3D_GATES = Object.freeze([
  Object.freeze({ id: 'athlete', label: 'Production athlete', status: 'accepted', statusLabel: 'BASE ACCEPTED' }),
  Object.freeze({ id: 'equipment', label: 'Authored equipment', status: 'accepted', statusLabel: 'AUTHORED' }),
  Object.freeze({ id: 'movement', label: 'Movement and contact', status: 'accepted', statusLabel: 'CONTACT LOCKED' }),
  Object.freeze({ id: 'replay', label: '12-player replay', status: 'review', statusLabel: 'RUNTIME REVIEW' }),
]);

export function canRenderVNext3D() {
  return VNEXT_3D_RELEASE.acceptedForPublicRuntime;
}
