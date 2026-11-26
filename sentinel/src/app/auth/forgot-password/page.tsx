'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';

type Stage='email'|'verify-email'|'reset-password'|'complete';
async function postAuth(path:string,body:Record<string,string>) {
  const response=await fetch('/api/auth/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result?.message||result?.error||'The request could not be completed. Please try again.');
  return result;
}
export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(''),[otp,setOtp]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [stage,setStage]=useState<Stage>('email'),[error,setError]=useState(''),[pending,setPending]=useState(false);
  async function sendVerification(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setPending(true);
    try {await postAuth('email-otp/send-verification-otp',{email,type:'email-verification'});setStage('verify-email');}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not send verification code.');}
    finally{setPending(false);}
  }
  async function verifyEmail(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setPending(true);
    try {
      await postAuth('email-otp/verify-email',{email,otp});
      setOtp('');
      await postAuth('email-otp/request-password-reset',{email});
      setStage('reset-password');
    } catch(cause){setError(cause instanceof Error?cause.message:'Email verification failed. Request a new code and try again.');}
    finally{setPending(false);}
  }
  async function resetPassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');
    if(password!==confirm){setError('The passwords do not match.');return;}
    if(password.length<8||password.length>128){setError('Use a password between 8 and 128 characters.');return;}
    setPending(true);
    try {await postAuth('email-otp/reset-password',{email,otp,password});setStage('complete');}
    catch(cause){setError(cause instanceof Error?cause.message:'Password setup failed. Request a new code and try again.');}
    finally{setPending(false);}
  }
  const heading=stage==='email'?'Set your password.':stage==='verify-email'?'Verify your email.':stage==='reset-password'?'Choose a password.':'Password set.';
  return <main className="flex min-h-screen flex-col justify-between bg-white px-6 py-8 sm:px-12 lg:px-16">
    <Link href="/"><BrandMark size={42}/></Link>
    <section className="mx-auto my-auto w-full max-w-[430px] py-12">
      <p className="eyebrow">Secure account setup</p><h1 className="mt-4 text-[36px] font-semibold tracking-[-.05em] text-[#102B45]">{heading}</h1>
      <p className="mt-3 text-[14px] leading-7 text-[#718697]">{stage==='email'?'Enter the email address for your provisioned Sentinel account. We’ll verify ownership before allowing a password to be created.':stage==='verify-email'?'Enter the one-time code sent to your inbox to prove you own this email address.':stage==='reset-password'?'Your email is verified. Enter the separate password-reset code we just sent, then choose your password.':'Your password is saved. You can change it later using the password reset flow.'}</p>
      {stage==='email'&&<form onSubmit={sendVerification} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Account email</span><input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@institution.org" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none transition placeholder:text-[#A7B6C2] focus:border-[#16B8B0] focus:bg-white"/></label>
        <button disabled={pending} className="flex w-full items-center justify-center rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white disabled:opacity-60">{pending?'Sending code…':'Send verification code'}</button>
      </form>}
      {stage==='verify-email'&&<form onSubmit={verifyEmail} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Email verification code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={otp} onChange={e=>setOtp(e.target.value.replace(/\\D/g,'').slice(0,6))} placeholder="6-digit code" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] tracking-[.25em] text-[#102B45] outline-none focus:border-[#16B8B0]"/></label>
        <button disabled={pending} className="flex w-full items-center justify-center rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white disabled:opacity-60">{pending?'Verifying…':'Verify email'}</button>
      </form>}
      {stage==='reset-password'&&<form onSubmit={resetPassword} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Password reset code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={otp} onChange={e=>setOtp(e.target.value.replace(/\\D/g,'').slice(0,6))} placeholder="6-digit code" className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] tracking-[.25em] text-[#102B45] outline-none focus:border-[#16B8B0]"/></label>
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">New password</span><input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none focus:border-[#16B8B0]"/></label>
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Confirm password</span><input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)} className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none focus:border-[#16B8B0]"/></label>
        <button disabled={pending} className="flex w-full items-center justify-center rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white disabled:opacity-60">{pending?'Saving password…':'Set password'}</button>
      </form>}
      {stage==='complete'&&<div className="mt-8 rounded-xl border border-[#CDEBE5] bg-[#F2FAF8] p-4 text-[13px] leading-6 text-[#176B62]">Email verified and password successfully set. Your account is ready for sign-in.</div>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[12px] text-[#B42318]">{error}</p>}
      <p className="mt-6 text-center text-[12px] text-[#7B91A1]"><Link href="/auth/sign-in" className="font-semibold text-[#087F86] hover:underline">Return to sign in</Link></p>
    </section><div className="border-t border-[#E8EEF2] pt-5"><SoftflixSignature/></div>
  </main>;
}
