'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) setError(result.error.message || 'Unable to sign in. Check your credentials.');
      else router.push('/workspace');
    } catch {
      setError('Sentinel could not complete sign-in. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-md rounded-2xl border border-[#e4e7ec] bg-white p-8 shadow-sm"><Link href="/" className="text-sm font-semibold text-[#155eef]">← Sentinel</Link><p className="mt-8 text-xs font-semibold uppercase tracking-[.18em] text-[#155eef]">Secure workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-sm leading-6 text-[#667085]">Sign in with an account provisioned by your institution’s administrator.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-sm font-medium">Email address</span><input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-lg border border-[#d0d5dd] px-3 py-3 text-sm outline-none focus:border-[#155eef] focus:ring-2 focus:ring-[#155eef]/15" /></label><label className="block"><span className="mb-2 block text-sm font-medium">Password</span><input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-lg border border-[#d0d5dd] px-3 py-3 text-sm outline-none focus:border-[#155eef] focus:ring-2 focus:ring-[#155eef]/15" /></label>{error && <p role="alert" className="rounded-lg bg-[#fef3f2] p-3 text-sm text-[#b42318]">{error}</p>}<button disabled={pending} className="w-full rounded-lg bg-[#155eef] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1849a9] disabled:cursor-not-allowed disabled:opacity-60">{pending ? 'Signing in…' : 'Sign in'}</button></form><p className="mt-6 text-xs leading-5 text-[#667085]">Account registration is managed by authorised administrators. Contact your institution if you need access.</p></section></main>;
}
