'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(''), [message,setMessage]=useState(''), [error,setError]=useState(''), [pending,setPending]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setError(''); setPending(true);
    try {
      const callbackURL=new URL('/workspace',window.location.origin).toString();
      const verification=await fetch('/api/auth/send-verification-email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,callbackURL})});
      const vr=await verification.json().catch(()=>({}));
      if(!verification.ok && vr?.code!=='EMAIL_ALREADY_VERIFIED') throw new Error(vr?.message||'Could not start email verification.');
      const reset=await fetch('/api/auth/request-password-reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,redirectTo:new URL('/auth/reset-password',window.location.origin).toString()})});
      const rr=await reset.json().catch(()=>({}));
      if(!reset.ok) throw new Error(rr?.message||'Could not request a password setup link.');
      setMessage('If this address belongs to a provisioned Sentinel account, verification and password-setup instructions have been sent. Check your inbox and spam folder.');
    } catch(cause) { setError(cause instanceof Error?cause.message:'Sentinel could not send the requested emails. Please try again.'); }
    finally { setPending(false); }
  }
  return <main className="flex min-h-screen flex-col justify-between bg-white px-6 py-8 sm:px-12 lg:px-16">
    <Link href="/"><BrandMark size={42}/></Link>
    <section className="mx-auto my-auto w-full max-w-[430px] py-12">
      <p className="eyebrow">Account access</p><h1 className="mt-4 text-[36px] font-semibold tracking-[-.05em] text-[#102B45]">Set your password.</h1>
      <p className="mt-3 text-[14px] leading-7 text-[#718697]">We’ll send a verification message and a one-time password setup link to your provisioned account email. The link expires after one hour.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Account email</span><input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@institution.org" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none transition placeholder:text-[#A7B6C2] focus:border-[#16B8B0] focus:bg-white"/></label>
        {error&&<p role="alert" className="rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[12px] text-[#B42318]">{error}</p>}
        {message&&<p role="status" className="rounded-xl border border-[#CDEBE5] bg-[#F2FAF8] p-3 text-[12px] leading-5 text-[#176B62]">{message}</p>}
        <button disabled={pending} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white transition hover:bg-[#174363] disabled:cursor-not-allowed disabled:opacity-60">{pending?'Sending secure links…':'Email me a setup link'}{!pending&&<span className="text-[#35D5C2]">→</span>}</button>
      </form>
      <p className="mt-6 text-center text-[12px] text-[#7B91A1]"><Link href="/auth/sign-in" className="font-semibold text-[#087F86] hover:underline">Return to sign in</Link></p>
    </section><div className="border-t border-[#E8EEF2] pt-5"><SoftflixSignature/></div>
  </main>;
}
