export default function GoonsquadHomeIcon({ className = '', ...props }) {
  return (
    <svg
      {...props}
      className={`goonsquad-home-icon ${className}`.trim()}
      data-brand-icon="goonsquad-home"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M4.4 8.4v-.7C4.4 4.6 7.5 2.5 12 2.5s7.6 2.1 7.6 5.2v.7" />
      <path d="M3.3 8.4h17.4v3.1c0 .8-.6 1.4-1.4 1.4H4.7c-.8 0-1.4-.6-1.4-1.4V8.4Z" />
      <path d="M5.2 9.7h6v1.9h-6zM14.1 9.7v1.9M16.1 9.7v1.9M18.1 9.7v1.9" />
      <path d="M5.4 13v1.6c0 1.5.8 2.7 2.1 3.5l.5 2.1h8l.5-2.1c1.3-.8 2.1-2 2.1-3.5V13" />
      <path d="M6.9 14.2c1.3-.7 2.6-.6 3.7.3-.5 1.2-1.5 1.9-2.7 1.9-1 0-1.5-.8-1-2.2ZM17.1 14.2c-1.3-.7-2.6-.6-3.7.3.5 1.2 1.5 1.9 2.7 1.9 1 0 1.5-.8 1-2.2Z" />
      <path d="m12 16.3-1 1.7h2l-1-1.7ZM8 19.1h8M10 19.1v1.1M12 19.1v1.1M14 19.1v1.1" />
    </svg>
  );
}
