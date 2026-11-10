import { LoginButton } from '@/components/login-button';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath = typeof params.next === 'string' ? params.next : '/account';
  const error = params.error;

  return (
    <div className="page-shell flex flex-col justify-center pt-16 md:pt-24 pb-24 min-h-[min(40rem,calc(100vh-7.5rem))]">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <header className="space-y-4">
          <p className="label-sm text-patina">Collector access</p>
          <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">Sign in with Google</h1>
          <p className="text-[15px] leading-6 text-on-surface-variant">
            Supabase Auth issues the session. The Express API then provisions a customer profile on first visit. Passwords are not stored in this application.
          </p>
        </header>
        {error ? (
          <p className="notice notice-error">
            {error === 'session' ? 'The sign-in session could not be completed.' : 'The authentication callback was incomplete.'}
          </p>
        ) : null}
        <LoginButton nextPath={nextPath} />
      </div>
    </div>
  );
}
