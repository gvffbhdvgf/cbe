'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setPending(true);
    setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || 'Unable to sign out');
      router.replace('/auth/sign-in');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out');
    } finally {
      setPending(false);
    }
  }

  return <div className="flex flex-col items-end gap-1">
    <button type="button" onClick={signOut} disabled={pending} className="rounded-lg border border-[#DCE6EC] px-3 py-2 text-[10px] font-semibold text-[#456176] transition hover:border-[#16B8B0] hover:text-[#087F86] disabled:opacity-60">{pending ? 'Signing out…' : 'Sign out'}</button>
    {error && <span role="alert" className="max-w-40 text-right text-[9px] text-[#B42318]">{error}</span>}
  </div>;
}
