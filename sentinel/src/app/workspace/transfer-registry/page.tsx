import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { isPlatformAdministrator } from '@/application/organisation/organisation-service';
import { getTransferRegistryQueue } from '@/application/organisation/transfer-registry-service';
import { TransferRegistryManager } from './transfer-registry-manager';

export default function TransferRegistryPage(){return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading transfer registry…</main>}><TransferRegistryContent/></Suspense>;}

async function TransferRegistryContent(){
 await connection();const {data}=await auth.getSession();if(!data?.user)redirect('/auth/sign-in');
 if(!await isPlatformAdministrator(data.user.id))redirect('/workspace/organisations');
 let queue;try{queue=await getTransferRegistryQueue(data.user.id);}catch{redirect('/workspace/organisations');}
 return <main className="min-h-screen bg-[#F4F8FA]"><header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href="/workspace/organisations" className="text-[11px] font-semibold text-[#087F86]">Institutions</Link><SignOutButton/></div></div></header><div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14"><div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace/organisations" className="hover:text-[#087F86]">Institutions</Link> / <span className="text-[#4F6B7E]">Transfer registry</span></div><div className="mt-8 max-w-[850px]"><p className="eyebrow">Institutional trust and safeguarding</p><h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45]">Transfer eligibility registry</h1><p className="mt-3 text-[13px] leading-7 text-[#718697]">Verify institutional identity before allowing an organisation to receive learner transfers. Every decision is independently reviewed and audited; learner identity is not part of this registry.</p></div><TransferRegistryManager initialQueue={queue}/><footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Official identity · Independent review · Audited eligibility</span></footer></div></main>;
}
