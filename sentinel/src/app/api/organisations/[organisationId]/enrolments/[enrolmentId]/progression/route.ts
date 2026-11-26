import { auth } from '@/lib/auth/server';
import { requestLearnerProgression, LearnerProgressionError } from '@/application/learner/progression-service';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request,context:{params:Promise<{organisationId:string;enrolmentId:string}>}) {
 const {data}=await auth.getSession(); if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId,enrolmentId}=await context.params; if(!uuidPattern.test(organisationId)||!uuidPattern.test(enrolmentId))return Response.json({error:'Invalid organisation or enrolment ID'},{status:400});
 let body:unknown; try{body=await request.json();}catch{return Response.json({error:'A valid JSON body is required'},{status:400});}
 if(!body||typeof body!=='object')return Response.json({error:'Invalid progression details'},{status:400});
 const value=body as Record<string,unknown>;
 if(typeof value.toGrade!=='number'||typeof value.toAcademicYear!=='number'||typeof value.effectiveAt!=='string'||typeof value.reason!=='string'||(value.targetClassId!==null&&typeof value.targetClassId!=='string'))return Response.json({error:'Target grade, year, effective date and reason are required'},{status:400});
 try{return Response.json(await requestLearnerProgression(data.user.id,organisationId,enrolmentId,{toGrade:value.toGrade,toAcademicYear:value.toAcademicYear,targetClassId:value.targetClassId as string|null,effectiveAt:value.effectiveAt,reason:value.reason}),{status:201});}
 catch(error){if(error instanceof LearnerProgressionError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to request learner progression'},{status:500});}
}
