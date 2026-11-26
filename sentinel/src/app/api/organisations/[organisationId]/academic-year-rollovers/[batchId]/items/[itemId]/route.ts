import { auth } from '@/lib/auth/server';
import { setAcademicYearRolloverItemDecision, AcademicYearRolloverError } from '@/application/learner/academic-year-rollover-service';

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const outcomes=['promote','repeat','not_progressing'] as const;

export async function PATCH(request:Request,context:{params:Promise<{organisationId:string;batchId:string;itemId:string}>}) {
 const {data}=await auth.getSession();
 if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId,batchId,itemId}=await context.params;
 if(!uuidPattern.test(organisationId)||!uuidPattern.test(batchId)||!uuidPattern.test(itemId))return Response.json({error:'Invalid rollover identifiers'},{status:400});
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:'A valid JSON body is required'},{status:400});}
 if(!body||typeof body!=='object'||!('outcome' in body)||typeof body.outcome!=='string'||!outcomes.includes(body.outcome as typeof outcomes[number])||!('reason' in body)||typeof body.reason!=='string'||!('targetClassId' in body)||(typeof body.targetClassId!=='string'&&body.targetClassId!==null))return Response.json({error:'A supported learner outcome, optional target class and reason are required'},{status:400});
 try{return Response.json(await setAcademicYearRolloverItemDecision(data.user.id,organisationId,batchId,itemId,body.outcome as typeof outcomes[number],body.targetClassId as string|null,body.reason));}
 catch(error){if(error instanceof AcademicYearRolloverError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to save learner rollover decision'},{status:409});}
}
