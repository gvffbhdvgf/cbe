import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { getGuardianPortalSummary } from '@/application/guardian/guardian-portal-service';
import { GuardianPortal } from './guardian-portal';

export default function GuardianPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading family access…</main>}><GuardianContent/></Suspense>;
}

async function GuardianContent() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let learners;
  try { learners = await getGuardianPortalSummary(data.user.id); }
  catch { redirect('/auth/sign-in'); }
  return <GuardianPortal learners={learners}/>;
}
