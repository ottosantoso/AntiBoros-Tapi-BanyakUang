import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase-client';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Diset saat pengguna datang dari tautan reset password (event PASSWORD_RECOVERY).
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, recovery, clearRecovery: () => setRecovery(false) };
}
