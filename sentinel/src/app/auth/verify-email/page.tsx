'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { authClient } from '@/lib/auth/client';

type Stage = 'email' | 'verify' | 'complete';

export default function VerifyEmailPage() {
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [stage,setStage]=useState<Stage>('email');
  const [error,setError]=useState('');
  const [pending,setPending]=useState(false);

  useEffect(() => {
    const invitedEmail = new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() ?? '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
      setEmail(invitedEmail);
      setStage('verify');
    }
  }, []);

  async function sendCode(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setPending(true);
    try {
      const result=await authClient.emailOtp.sendVerificationOtp({email:email.trim().toLowerCase(),type:'email-verification'});
      if(result.error) throw new Error(result.error.message||'Could not send the verification code.');
      setStage('verify');
    } catch(cause) { setError(cause instanceof Error?cause.message:'Could not send the verification code.'); }
    finally { setPending(false); }
  }

  async function verify(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setPending(true);
    try {
      const result=await authClient.emailOtp.verifyEmail({email:email.trim().toLowerCase(),otp});
      if(result.error) throw new Error(result.error.message||'Email verification failed. Check the code and try again.');
      setStage('complete');
    } catch(cause) { setError(cause instanceof Error?cause.message:'Email verification failed.'); }
    finally { setPending(false); }
  }

  return <main className="flex min-h-screen flex-col justify-between bg-white px-6 py-8 sm:px-12 lg:px-16">
    <Link href="/"><BrandMark size={42}/></Link>
    <section className="mx-auto my-auto w-full max-w-[430px] py-12">
      <p className="eyebrow">Sentinel account setup</p>
      <h1 className="mt-4 text-[36px] font-semibold tracking-[-.05em] text-[#102B45]">{stage==='complete'?'Email verified.':'Verify your email.'}</h1>
      <p className="mt-3 text-[14px] leading-7 text-[#718697]">{stage==='email'?'Enter the email address your institution registered for your account. We will send a one-time verification code.':stage==='verify'?'Enter the six-digit code sent to your inbox. Your institution can link your account to the appropriate staff or guardian record only after this verification succeeds.':'Your email address is verified. Set a password before signing in to Sentinel.'}</p>
      {stage==='email'&&<form onSubmit={sendCode} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Account email</span><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none focus:border-[#16B8B0]"/></label><button disabled={pending} className="w-full rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white disabled:opacity-60">{pending?'Sending code…':'Send verification code'}</button></form>}
      {stage==='verify'&&<><p className="mt-4 rounded-xl bg-[#F4F8FA] p-3 text-[11px] leading-5 text-[#526F83]">A verification code was sent to <strong>{email}</strong>. Enter that code below to finish setting up your account.</p><form onSubmit={verify} className="mt-5 space-y-5"><label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Six-digit email code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] tracking-[.25em] text-[#102B45] outline-none focus:border-[#16B8B0]"/></label><button disabled={pending} className="w-full rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white disabled:opacity-60">{pending?'Verifying…':'Verify email'}</button><button type="button" disabled={pending} onClick={()=>{setStage('email');setOtp('');}} className="w-full text-[11px] font-semibold text-[#087F86]">Use a different email address</button></form></>}
      {stage==='complete'&&<div className="mt-8 space-y-4"><div role="status" className="rounded-xl border border-[#CDEBE5] bg-[#F2FAF8] p-4 text-[12px] leading-6 text-[#176B62]">Email verification is complete. Your email is verified. Your institution can now link this account to your approved staff or guardian record.</div><Link href="/auth/forgot-password" className="flex w-full items-center justify-center rounded-xl bg-[#087F86] px-4 py-4 text-[13px] font-semibold text-white">Choose your password</Link><p className="text-center text-[11px] text-[#8296A5]">After setting your password, sign in to open your family access page.</p></div>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[12px] text-[#B42318]">{error}</p>}
      <p className="mt-6 text-center text-[12px] text-[#7B91A1]"><Link href="/auth/sign-in" className="font-semibold text-[#087F86] hover:underline">Return to sign in</Link></p>
    </section>
    <div className="border-t border-[#E8EEF2] pt-5"><SoftflixSignature/></div>
  </main>;
}
