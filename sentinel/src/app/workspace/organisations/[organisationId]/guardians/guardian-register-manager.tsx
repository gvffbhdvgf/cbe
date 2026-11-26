'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

type PersonMatch = { id: string; legalFirstName: string; legalMiddleName: string | null; legalLastName: string; preferredName: string | null };
type LearnerOption = { id: string; learnerReference: string; firstName: string; lastName: string; preferredName: string | null; grade: number; academicYear: number; enrolmentStatus: string };
type Relationship = {
  id: string; learnerId: string; guardianPersonId: string; relationshipType: string; verificationStatus: string;
  status: string; canViewProgress: boolean; canReceiveMessages: boolean; startsAt: string; endsAt: string | null;
  learner: LearnerOption | null;
};
type Guardian = {
  id: string; personId: string; contactEmail: string | null; verificationStatus: string; status: string;
  userId: string | null; linkedEmail: string | null; verifiedAt: string | null;
  person: { id: string; firstName: string; middleName: string | null; lastName: string; preferredName: string | null } | null;
  relationships: Relationship[];
};
type Summary = { organisation: { id: string; name: string; timeZone: string }; learners: LearnerOption[]; guardians: Guardian[]; personMatches: PersonMatch[] };

const field = 'mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label = 'block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';
const todayInKenya = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const displayName = (p: { firstName?: string; lastName?: string; middleName?: string | null; preferredName?: string | null; legalFirstName?: string; legalLastName?: string; legalMiddleName?: string | null }) =>
  [p.preferredName || p.firstName || p.legalFirstName, p.middleName || p.legalMiddleName, p.lastName || p.legalLastName].filter(Boolean).join(' ');
const titleCase = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());

export function GuardianRegisterManager({ organisationId, initialSummary }: { organisationId: string; initialSummary: Summary }) {
  const router = useRouter();
  const [summary,setSummary]=useState(initialSummary);
  const [learnerId,setLearnerId]=useState('');
  const [personSearch,setPersonSearch]=useState('');
  const [searchPerformed,setSearchPerformed]=useState(false);
  const [selectedPerson,setSelectedPerson]=useState<PersonMatch|null>(null);
  const [firstName,setFirstName]=useState('');
  const [middleName,setMiddleName]=useState('');
  const [lastName,setLastName]=useState('');
  const [preferredName,setPreferredName]=useState('');
  const [contactEmail,setContactEmail]=useState('');
  const [relationshipType,setRelationshipType]=useState('mother');
  const [startsOn,setStartsOn]=useState(todayInKenya());
  const [endsOn,setEndsOn]=useState('');
  const [confirmDistinctPerson,setConfirmDistinctPerson]=useState(false);
  const [methods,setMethods]=useState<Record<string,string>>({});
  const [evidence,setEvidence]=useState<Record<string,string>>({});
  const [rejectionReasons,setRejectionReasons]=useState<Record<string,string>>({});
  const [progressPermissions,setProgressPermissions]=useState<Record<string,boolean>>({});
  const [messagePermissions,setMessagePermissions]=useState<Record<string,boolean>>({});
  const [revokeReasons,setRevokeReasons]=useState<Record<string,string>>({});
  const [invitationLinks,setInvitationLinks]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function reload(search=personSearch) {
    const response=await fetch('/api/organisations/'+organisationId+'/guardians?personSearch='+encodeURIComponent(search));
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||'Unable to refresh the guardian register.');
    setSummary(payload as Summary);
  }
  async function runAction(key:string,body:Record<string,unknown>,success:string) {
    setBusy(key);setError('');setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/guardians',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'The guardian action could not be completed.');
      await reload('');
      setMessage(success);
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'The guardian action could not be completed.'); }
    finally { setBusy(''); }
  }
  async function searchPeople() {
    setBusy('search');setError('');setMessage('');
    try { await reload(personSearch);setSearchPerformed(true); }
    catch(cause) { setError(cause instanceof Error?cause.message:'Unable to search existing people.'); }
    finally { setBusy(''); }
  }

  async function inviteGuardianAccount(guardian: Guardian) {
    if (!guardian.contactEmail || !guardian.person) return;
    setBusy('invite:'+guardian.id);setError('');setMessage('');
    try {
      const temporaryPassword = crypto.randomUUID() + crypto.randomUUID();
      const created = await authClient.admin.createUser({
        email: guardian.contactEmail,
        password: temporaryPassword,
        name: personName(guardian),
        role: 'user',
      });
      if (created.error) throw new Error(created.error.message || 'Could not provision the guardian account.');
      const verification = await authClient.emailOtp.sendVerificationOtp({
        email: guardian.contactEmail,
        type: 'email-verification',
      });
      if (verification.error) throw new Error('The account was created, but the verification code could not be sent: ' + verification.error.message);
      const link = window.location.origin + '/auth/verify-email';
      setInvitationLinks(current => ({ ...current, [guardian.id]: link }));
      const audit = await fetch('/api/organisations/'+organisationId+'/guardians', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'record-invitation', profileId: guardian.id, email: guardian.contactEmail }),
      });
      const auditPayload = await audit.json();
      if (!audit.ok) throw new Error(auditPayload.error || 'The invitation was sent but its audit record could not be saved.');
      setMessage('Guardian account created and verification code sent. Share the setup page with the guardian; do not share the temporary password.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the guardian account invitation.');
    } finally { setBusy(''); }
  }

  async function copyInvitationLink(profileId: string) {
    const link = invitationLinks[profileId];
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setMessage('Guardian setup link copied.'); }
    catch { setError('Clipboard access was unavailable. Copy this link manually: ' + link); }
  }
  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('create',{
      action:'create',learnerId,personId:selectedPerson?.id??null,
      firstName:selectedPerson?null:firstName,middleName:selectedPerson?null:middleName,
      lastName:selectedPerson?null:lastName,preferredName:selectedPerson?null:preferredName,
      contactEmail:contactEmail||null,relationshipType,startsOn,endsOn:endsOn||null,
      confirmDistinctPerson:selectedPerson?false:confirmDistinctPerson,
    },'Guardian relationship submitted for independent verification.');
    setLearnerId('');setSelectedPerson(null);setFirstName('');setMiddleName('');setLastName('');setPreferredName('');
    setContactEmail('');setRelationshipType('mother');setStartsOn(todayInKenya());setEndsOn('');setConfirmDistinctPerson(false);
    setPersonSearch('');setSearchPerformed(false);
  }

  const methodFor=(id:string)=>methods[id]||'school_record';
  const evidenceFor=(id:string)=>evidence[id]||'';
  const personName=(guardian:Guardian)=>guardian.person?displayName(guardian.person):'Guardian person record';
  return <div className="mt-8 space-y-6">
    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <p className="eyebrow">Safeguarding and family relationships</p>
      <h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Register a guardian relationship</h2>
      <p className="mt-2 max-w-[800px] text-[11px] leading-6 text-[#718697]">A relationship starts as pending with no learner access. A second authorised staff member must verify the guardian identity and the specific relationship independently before permissions can be granted.</p>
      <form onSubmit={create} className="mt-6 space-y-5">
        <div><label className={label}>Learner</label><select required value={learnerId} onChange={e=>setLearnerId(e.target.value)} className={field}><option value="">Choose an active learner</option>{summary.learners.map(l=><option key={l.id} value={l.id}>{l.learnerReference} · {l.preferredName||l.firstName} {l.lastName} · Grade {l.grade} ({l.academicYear})</option>)}</select></div>
        <div className="rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4">
          <label className={label}>Find an existing person before creating a guardian record</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={personSearch} onChange={e=>{setPersonSearch(e.target.value);setSearchPerformed(false);}} placeholder="Search legal or preferred name" className={field}/><button type="button" disabled={busy!==''||personSearch.trim().length<2} onClick={()=>void searchPeople()} className="shrink-0 rounded-full border border-[#BFD8D8] px-4 py-2 text-[10px] font-semibold text-[#087F86] disabled:opacity-40">{busy==='search'?'Searching…':'Search people'}</button></div>
          {selectedPerson&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#EAF7F5] p-3"><p className="text-[11px] font-semibold text-[#245A5B]">Using existing person: {displayName(selectedPerson)}</p><button type="button" onClick={()=>setSelectedPerson(null)} className="text-[10px] font-semibold text-[#087F86]">Clear selection</button></div>}
          {!selectedPerson&&searchPerformed&&<div className="mt-3 space-y-2">{summary.personMatches.length?summary.personMatches.map(p=><button key={p.id} type="button" onClick={()=>setSelectedPerson(p)} className="flex w-full items-center justify-between rounded-xl border border-[#E5EDF1] bg-white px-3 py-2 text-left hover:border-[#8CCFC7]"><span className="text-[11px] font-medium text-[#29465D]">{displayName(p)}</span><span className="text-[10px] font-semibold text-[#087F86]">Select person</span></button>):<p className="text-[11px] text-[#718697]">No matching person found. Confirm the identity is distinct before creating a new person record.</p>}</div>}
        </div>
        {!selectedPerson&&<div className="grid gap-3 sm:grid-cols-2">
          <div><label className={label}>Legal first name</label><input required value={firstName} onChange={e=>setFirstName(e.target.value)} className={field}/></div>
          <div><label className={label}>Legal last name</label><input required value={lastName} onChange={e=>setLastName(e.target.value)} className={field}/></div>
          <div><label className={label}>Middle name (optional)</label><input value={middleName} onChange={e=>setMiddleName(e.target.value)} className={field}/></div>
          <div><label className={label}>Preferred name (optional)</label><input value={preferredName} onChange={e=>setPreferredName(e.target.value)} className={field}/></div>
          <label className="flex items-start gap-2 text-[11px] text-[#627B8E] sm:col-span-2"><input type="checkbox" checked={confirmDistinctPerson} onChange={e=>setConfirmDistinctPerson(e.target.checked)} className="mt-0.5"/> I searched the organisation's person register and confirmed this is a distinct person.</label>
        </div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={label}>Guardian contact email (optional)</label><input type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} className={field} placeholder="Used only for verified account linking"/></div>
          <div><label className={label}>Relationship to learner</label><select value={relationshipType} onChange={e=>setRelationshipType(e.target.value)} className={field}>{['mother','father','parent','legal_guardian','foster_parent','grandparent','sibling','relative','other'].map(v=><option key={v} value={v}>{titleCase(v)}</option>)}</select></div>
          <div><label className={label}>Effective from</label><input type="date" required value={startsOn} onChange={e=>setStartsOn(e.target.value)} className={field}/></div>
          <div><label className={label}>Effective until (optional)</label><input type="date" min={startsOn} value={endsOn} onChange={e=>setEndsOn(e.target.value)} className={field}/></div>
        </div>
        <button disabled={busy!==''||!learnerId||(!selectedPerson&&(!firstName.trim()||!lastName.trim()||!confirmDistinctPerson))} className="rounded-full bg-[#087F86] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40">{busy==='create'?'Submitting…':'Create pending relationship'}</button>
      </form>
    </section>

    {error&&<div role="alert" className="rounded-xl border border-[#F1D2CC] bg-[#FFF7F5] px-4 py-3 text-[11px] text-[#9A4B3D]">{error}</div>}
    {message&&<div role="status" className="rounded-xl border border-[#CFE8E2] bg-[#F1FAF7] px-4 py-3 text-[11px] text-[#28675D]">{message}</div>}

    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Verification register</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Guardian identities and relationships</h2></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{summary.guardians.length} guardian profiles</span></div>
      {summary.guardians.length===0?<div className="mt-6 rounded-2xl border border-dashed border-[#DCE7EC] bg-[#FBFDFD] p-8 text-center"><p className="text-[12px] font-semibold text-[#35556B]">No guardian profiles yet</p><p className="mt-2 text-[11px] text-[#8296A5]">New relationships will appear here as pending until independently reviewed.</p></div>:<div className="mt-5 space-y-4">
        {summary.guardians.map(guardian=><article key={guardian.id} className="rounded-2xl border border-[#E5EDF1] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-[13px] font-semibold text-[#29465D]">{personName(guardian)}</h3><p className="mt-1 text-[10px] text-[#8296A5]">{guardian.contactEmail||'No contact email recorded'}{guardian.linkedEmail?' · Account linked: '+guardian.linkedEmail:''}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#F3F7F9] px-2.5 py-1 text-[9px] font-semibold text-[#718697]">{titleCase(guardian.verificationStatus)}</span><span className="rounded-full bg-[#F3F7F9] px-2.5 py-1 text-[9px] font-semibold text-[#718697]">{titleCase(guardian.status)}</span></div></div>
          {guardian.verificationStatus==='pending'&&<div className="mt-4 grid gap-2 rounded-xl bg-[#FBFDFD] p-3 sm:grid-cols-2">
            <div><label className={label}>Identity verification method</label><select value={methodFor(guardian.id)} onChange={e=>setMethods(s=>({...s,[guardian.id]:e.target.value}))} className={field}><option value="school_record">School record</option><option value="official_document">Official document</option><option value="in_person">In person</option><option value="guardian_otp">Guardian OTP (provider evidence only)</option><option value="other">Other</option></select></div>
            <div><label className={label}>Evidence reference (no document contents)</label><input value={evidenceFor(guardian.id)} onChange={e=>setEvidence(s=>({...s,[guardian.id]:e.target.value}))} className={field} placeholder="Register / case reference"/></div>
            <div className="sm:col-span-2"><label className={label}>Rejection reason (if rejecting)</label><input value={rejectionReasons[guardian.id]||''} onChange={e=>setRejectionReasons(s=>({...s,[guardian.id]:e.target.value}))} className={field}/></div>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy!==''||evidenceFor(guardian.id).trim().length<3} onClick={()=>void runAction('profile:'+guardian.id,{action:'review-profile',profileId:guardian.id,decision:'verified',method:methodFor(guardian.id),evidenceReference:evidenceFor(guardian.id)},'Guardian identity verified independently.')} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Verify identity</button><button disabled={busy!==''||evidenceFor(guardian.id).trim().length<3||!(rejectionReasons[guardian.id]||'').trim()} onClick={()=>void runAction('profile:'+guardian.id,{action:'review-profile',profileId:guardian.id,decision:'rejected',method:methodFor(guardian.id),evidenceReference:evidenceFor(guardian.id),rejectionReason:rejectionReasons[guardian.id]},'Guardian identity review recorded as rejected.')} className="rounded-full border border-[#E4C8C1] px-4 py-2 text-[10px] font-semibold text-[#9A4B3D] disabled:opacity-40">Reject identity</button></div>
            <p className="text-[10px] leading-5 text-[#8296A5] sm:col-span-2">The person who created this profile cannot review it. Keep sensitive document images outside audit metadata; record only the controlled evidence reference.</p>
          </div>}
          {guardian.verificationStatus==='verified'&&guardian.userId===null&&guardian.contactEmail&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F4F8FA] p-3"><p className="max-w-[520px] text-[10px] leading-5 text-[#718697]">Provision a new account and send an email verification code, or link an existing account after its owner verifies the same email address.</p><div className="flex flex-wrap gap-2"><button disabled={busy!==''||Boolean(invitationLinks[guardian.id])} onClick={()=>void inviteGuardianAccount(guardian)} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">{busy==='invite:'+guardian.id?'Creating…':'Create account & send code'}</button><button disabled={busy!==''} onClick={()=>void runAction('link:'+guardian.id,{action:'link-account',profileId:guardian.id,email:guardian.contactEmail},'Verified guardian account linked.')} className="rounded-full border border-[#BFD8D8] px-4 py-2 text-[10px] font-semibold text-[#087F86] disabled:opacity-40">Link existing verified account</button></div>{invitationLinks[guardian.id]&&<div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"><p className="text-[10px] text-[#627B8E]">Share this setup page so the guardian can verify their email and choose a password.</p><button type="button" onClick={()=>void copyInvitationLink(guardian.id)} className="text-[10px] font-semibold text-[#087F86]">Copy setup link</button></div>}</div>}
          <div className="mt-4 space-y-3">{guardian.relationships.map(rel=><div key={rel.id} className="rounded-xl border border-[#EAF0F3] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[11px] font-semibold text-[#35556B]">{rel.learner?displayName({firstName:rel.learner.firstName,lastName:rel.learner.lastName,preferredName:rel.learner.preferredName}):'Learner record'} · {titleCase(rel.relationshipType)}</p><p className="mt-1 text-[10px] text-[#8296A5]">{rel.learner?.learnerReference||'—'} · {rel.learner?'Grade '+rel.learner.grade+' ('+rel.learner.academicYear+')':'No active enrolment'}</p></div><span className="rounded-full bg-[#F3F7F9] px-2.5 py-1 text-[9px] font-semibold text-[#718697]">{titleCase(rel.verificationStatus)} · {titleCase(rel.status)}</span></div>
            {rel.verificationStatus==='pending'&&guardian.verificationStatus==='verified'&&<div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><label className={label}>Relationship evidence method</label><select value={methodFor(rel.id)} onChange={e=>setMethods(s=>({...s,[rel.id]:e.target.value}))} className={field}><option value="school_record">School record</option><option value="official_document">Official document</option><option value="in_person">In person</option><option value="guardian_otp">Guardian OTP (provider evidence only)</option><option value="other">Other</option></select></div>
              <div><label className={label}>Evidence reference</label><input value={evidenceFor(rel.id)} onChange={e=>setEvidence(s=>({...s,[rel.id]:e.target.value}))} className={field} placeholder="Register / case reference"/></div>
              <label className="flex items-center gap-2 text-[10px] text-[#627B8E]"><input type="checkbox" checked={progressPermissions[rel.id]??false} onChange={e=>setProgressPermissions(s=>({...s,[rel.id]:e.target.checked}))}/> May view permitted learner progress</label>
              <label className="flex items-center gap-2 text-[10px] text-[#627B8E]"><input type="checkbox" checked={messagePermissions[rel.id]??false} onChange={e=>setMessagePermissions(s=>({...s,[rel.id]:e.target.checked}))}/> May receive institution messages</label>
              <div className="sm:col-span-2"><label className={label}>Rejection reason (if rejecting)</label><input value={rejectionReasons[rel.id]||''} onChange={e=>setRejectionReasons(s=>({...s,[rel.id]:e.target.value}))} className={field}/></div>
              <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy!==''||evidenceFor(rel.id).trim().length<3} onClick={()=>void runAction('relationship:'+rel.id,{action:'review-relationship',relationshipId:rel.id,decision:'verified',method:methodFor(rel.id),evidenceReference:evidenceFor(rel.id),canViewProgress:progressPermissions[rel.id]??false,canReceiveMessages:messagePermissions[rel.id]??false},'Guardian relationship verified with the selected permissions.')} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Verify relationship</button><button disabled={busy!==''||evidenceFor(rel.id).trim().length<3||!(rejectionReasons[rel.id]||'').trim()} onClick={()=>void runAction('relationship:'+rel.id,{action:'review-relationship',relationshipId:rel.id,decision:'rejected',method:methodFor(rel.id),evidenceReference:evidenceFor(rel.id),rejectionReason:rejectionReasons[rel.id],canViewProgress:false,canReceiveMessages:false},'Guardian relationship review recorded as rejected.')} className="rounded-full border border-[#E4C8C1] px-4 py-2 text-[10px] font-semibold text-[#9A4B3D] disabled:opacity-40">Reject relationship</button></div>
            </div>}
            {rel.verificationStatus==='verified'&&rel.status==='active'&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] text-[#718697]">Permissions: {rel.canViewProgress?'Progress':'No progress'} · {rel.canReceiveMessages?'Messages':'No messages'}</p><div className="flex items-center gap-2"><input value={revokeReasons[rel.id]||''} onChange={e=>setRevokeReasons(s=>({...s,[rel.id]:e.target.value}))} className={field+' max-w-[230px]'} placeholder="Reason to revoke"/><button disabled={busy!==''||!(revokeReasons[rel.id]||'').trim()} onClick={()=>void runAction('revoke:'+rel.id,{action:'revoke-relationship',relationshipId:rel.id,reason:revokeReasons[rel.id]},'Guardian relationship revoked and permissions removed.')} className="rounded-full border border-[#E4C8C1] px-3 py-2 text-[10px] font-semibold text-[#9A4B3D] disabled:opacity-40">Revoke</button></div></div>}
          </div>)}</div>
        </article>)}
      </div>}
    </section>
  </div>;
}
