import Link from 'next/link';

export function Button({ href, children, variant = 'primary', className = '', ...props }) {
  const classes = `${variant === 'secondary' ? 'btn-secondary' : 'btn-primary'} ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} type={props.type || 'button'} {...props}>
      {children}
    </button>
  );
}

export function Notice({ children, tone = 'default' }) {
  return <div className={`notice ${tone === 'error' ? 'notice-error' : ''}`}>{children}</div>;
}

export function PageIntro({ eyebrow, title, description, actions }) {
  return (
    <header className="max-w-7xl mx-auto px-6 md:px-16 pt-12 md:pt-20 pb-10 space-y-4">
      {eyebrow ? <p className="label-sm text-patina">{eyebrow}</p> : null}
      <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">{title}</h1>
      {description ? <p className="max-w-2xl text-[15px] leading-6 text-on-surface-variant">{description}</p> : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
    </header>
  );
}

export function Field({ label, children, hint, error }) {
  return (
    <label className="block space-y-2">
      <span className="label-md text-patina">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-patina">{hint}</span> : null}
      {error ? <span className="block text-xs text-error">{error}</span> : null}
    </label>
  );
}

export function Divider() {
  return <hr className="hairline" />;
}
