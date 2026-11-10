'use client';

import { useState } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { pendingButtonProps } from '@/lib/pending-action';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { ActionStatus, ButtonLoader } from './loading';

export function LoginButton({ nextPath = '/account' }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <p className="notice notice-error">
        Google sign-in is not available until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.
      </p>
    );
  }

  async function signIn() {
    setPending(true);
    setError('');
    try {
      const supabase = createBrowserSupabaseClient();
      const origin = window.location.origin;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (authError) {
        throw authError;
      }
    } catch (caught) {
      setError(caught.message || 'Google sign-in could not start.');
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <button className="btn-primary w-full" type="button" {...pendingButtonProps(pending)} onClick={signIn}>
        {pending ? <ButtonLoader label="Opening Google…" /> : 'Continue with Google'}
      </button>
      <ActionStatus pending={pending} pendingLabel="Opening Google sign-in" error={error} />
    </div>
  );
}
