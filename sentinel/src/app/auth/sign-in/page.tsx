'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setPending(true);
    try { const result = await authClient.signIn.email({ email, password }); if (result.error) setError(result.error.message || 'Unable to sign in. Check your credentials.'); else router.push('/workspace'); }
    catch { setError('Sentinel could not complete sign-in. Please try again.'); }
    finally { setPending(false); }
  }

  return <main className="grid min-h-screen bg-white lg:grid-cols-[1.03fr_.97fr]">
    <section className="relative hidden overflow-hidden bg-[#0B2035] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20"><div className="hero-grid absolute inset-0 opacity-60"/><div className="hero-orb absolute -bottom-40 -right-40 size-[560px] rounded-full"/><div className="relative"><Link href="/"><BrandMark size={46} light/></Link><div className="mt-28 max-w-[520px]"><p className="eyebrow text-[#65DCCB]">A clearer picture</p><h1 className="mt-6 text-5xl font-semibold leading-[1.04] tracking-[-.055em]">Good decisions begin with <span className="text-[#55D9C9]">the whole story.</span></h1><p className="mt-7 max-w-[430px] text-sm leading-7 text-[#A7BBC9]">A secure, connected workspace for the people shaping learning and opportunity.</p></div></div><div className="relative flex items-center justify-between"><SoftflixSignature light/><span className="text-[10px] uppercase tracking-[.16em] text-[#7893A5]">People · Evidence · Outcomes</span></div></section>
    <section className="flex min-h-screen flex-col justify-between px-6 py-8 sm:px-12 lg:px-16 xl:px-24"><div className="lg:hidden"><Link href="/"><BrandMark size={42}/></Link></div><div className="mx-auto my-auto w-full max-w-[410px] py-12"><p className="eyebrow">Secure workspace</p><h2 className="mt-4 text-[38px] font-semibold tracking-[-.055em] text-[#102B45]">Welcome back.</h2><p className="mt-3 text-[14px] leading-7 text-[#718697]">Sign in with an account provisioned by your institution’s administrator.</p>
      <form onSubmit={submit} className="mt-9 space-y-5"><label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Email address</span><input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@institution.org" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none transition placeholder:text-[#A7B6C2] focus:border-[#16B8B0] focus:bg-white"/></label><label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Password</span><input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none transition placeholder:text-[#A7B6C2] focus:border-[#16B8B0] focus:bg-white"/></label>{error && <p role="alert" className="rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[12px] text-[#B42318]">{error}</p>}<button disabled={pending} className="focus-ring flex w-full items-center justify-center gap-3 rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(16,43,69,.13)] transition hover:-translate-y-0.5 hover:bg-[#174363] disabled:cursor-not-allowed disabled:opacity-60">{pending ? 'Signing in…' : 'Continue to Sentinel'}{!pending && <span className="text-[#35D5C2]">→</span>}</button></form>
      <div className="mt-7 flex items-start gap-3 rounded-xl bg-[#F2F8F8] p-4"><span className="mt-0.5 text-[#087F86]">◈</span><p className="text-[11px] leading-5 text-[#6D8494]">Access is managed by authorised administrators. Contact your institution if you need an account or assistance.</p></div></div><div className="flex items-center justify-between border-t border-[#E8EEF2] pt-5"><SoftflixSignature/><Link href="/" className="text-[11px] font-medium text-[#7B91A1] hover:text-[#087F86]">Back to Sentinel ↗</Link></div></section>
  </main>;
}
