import {
  Camera,
  ExternalLink,
  Music2,
  PlaySquare,
} from 'lucide-react';
import { GOONSQUAD_SOCIAL_LINKS } from './teamBrand';
import './brand.css';

const SOCIAL_ICONS = Object.freeze({
  instagram: Camera,
  tiktok: Music2,
  youtube: PlaySquare,
});

export default function OfficialSocialLinks({
  compact = false,
  label = 'Follow Goonsquad',
}) {
  return (
    <nav
      className={`goonsquad-social-links ${compact ? 'is-compact' : ''}`}
      aria-label={label}
    >
      {!compact && <span>FOLLOW GOONSQUAD</span>}
      <div>
        {GOONSQUAD_SOCIAL_LINKS.map((link) => {
          const Icon = SOCIAL_ICONS[link.id] || ExternalLink;
          return (
            <a
              href={link.href}
              key={link.id}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open Goonsquad on ${link.label}`}
              title={`${link.label} ${link.handle}`}
              data-platform={link.id}
            >
              <Icon aria-hidden="true" />
              {!compact && (
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.handle}</small>
                </span>
              )}
              {!compact && <ExternalLink aria-hidden="true" />}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
