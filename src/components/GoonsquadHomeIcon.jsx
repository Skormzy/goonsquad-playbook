import homeMarkMask from '../assets/goonsquad-home-mark-mask.png';

export default function GoonsquadHomeIcon({ className = '', style, ...props }) {
  return (
    <span
      {...props}
      className={`goonsquad-home-icon ${className}`.trim()}
      data-brand-icon="goonsquad-home"
      style={{
        ...style,
        '--goonsquad-home-mark': `url(${homeMarkMask})`,
      }}
    />
  );
}
