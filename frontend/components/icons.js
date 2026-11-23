export function IconSearch({ className = 'h-5 w-5 shrink-0' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconHeart({ className = 'h-5 w-5 shrink-0', filled = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconBag({ className = 'h-5 w-5 shrink-0' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconMenu({ className = 'h-5 w-5 shrink-0' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconClose({ className = 'h-5 w-5 shrink-0' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconArrow({ className = 'h-4 w-4 shrink-0' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconWhatsapp({ className = 'h-6 w-6 shrink-0' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.12h.01c5.46 0 9.89-4.4 9.89-9.84C21.94 6.4 17.5 2 12.04 2Zm5.77 13.99c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.95-.31-1.64-.6-2.89-1.25-4.77-4.16-4.92-4.36-.14-.2-1.18-1.56-1.18-2.98 0-1.41.74-2.11 1-2.4.26-.28.57-.35.76-.35h.55c.17 0 .41-.07.64.49.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.2-.14.31-.28.48-.14.16-.3.37-.42.49-.14.14-.29.29-.12.57.16.28.73 1.2 1.56 1.94 1.07.96 1.97 1.26 2.25 1.4.28.14.44.12.61-.07.16-.2.7-.81.89-1.09.19-.28.37-.23.63-.14.26.1 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}
