import { LoginButton } from '@/components/login-button';
import { PageIntro } from '@/components/ui';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath = typeof params.next === 'string' ? params.next : '/account';
  const error = params.error;

  return (
    <div>
      <PageIntro
        eyebrow="Collector access"
        title="Sign in with Google"
        description="Supabase Auth issues the session. The Express API then provisions a customer profile on first visit. Passwords are not stored in this application."
      />
      <div className="max-w-md mx-auto px-6 pb-24 space-y-6">
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
