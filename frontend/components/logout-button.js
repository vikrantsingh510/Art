'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { isSupabaseConfigured } from '@/lib/env';
import { pendingButtonProps } from '@/lib/pending-action';
import { ButtonLoader } from './loading';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
      }
      router.push('/');
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button className="btn-secondary" type="button" {...pendingButtonProps(pending)} onClick={signOut}>
      {pending ? <ButtonLoader label="Signing out…" /> : 'Sign out'}
    </button>
  );
}
