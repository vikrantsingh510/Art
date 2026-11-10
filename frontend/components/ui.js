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

export function PageIntro({ eyebrow, title, description, actions, children }) {
  return (
    <header className={`page-shell pt-12 md:pt-20 ${children ? 'pb-24' : 'pb-10'}`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <div className="lg:col-span-5 space-y-4">
          {eyebrow ? <p className="label-sm text-patina">{eyebrow}</p> : null}
          <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">{title}</h1>
        </div>
        <div className="lg:col-span-7 space-y-8">
          {description ? (
            <p className="max-w-xl text-[15px] leading-6 text-on-surface-variant">{description}</p>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          {children}
        </div>
      </div>
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
