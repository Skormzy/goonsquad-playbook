export const GOONSQUAD_NAME = 'Goonsquad';
export const GOONSQUAD_NAME_UPPER = 'GOONSQUAD';
export const GOONSQUAD_MOTTO = 'Goon with the squad';
export const GOONSQUAD_LOGO_SRC = '/goonsquad-logo-v3.png';
export const GOONSQUAD_CREST_SRC = '/goonsquad-crest-v3.png';

export const GOONSQUAD_SOCIAL_LINKS = Object.freeze([
  {
    id: 'youtube',
    label: 'YouTube',
    handle: '@goonsquadbhc',
    href: 'https://youtube.com/@goonsquadbhc',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@goonsquad_bhc',
    href: 'https://www.instagram.com/goonsquad_bhc',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    handle: '@goonsquad.bhc',
    href: 'https://www.tiktok.com/@goonsquad.bhc',
  },
]);

export function goonsquadDisplayText(value) {
  return String(value ?? '')
    .replace(/\bGOON SQUAD\b/gu, GOONSQUAD_NAME_UPPER)
    .replace(/\bGoon Squad\b/gu, GOONSQUAD_NAME)
    .replace(/\bgoon squad\b/giu, GOONSQUAD_NAME);
}
