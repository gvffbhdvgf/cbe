import { auth } from '@/lib/auth/server';
import { createAcademicYearRollover, listAcademicYearRollovers, AcademicYearRolloverError } from '@/application/learner/academic-year-rollover-service';

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request:Request,context:{params:Promise<{organisationId:string}>}) {
 const {data}=await auth.getSession();
 if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId}=await context.params;
 if(!uuidPattern.test(organisationId))return Response.json({error:'Invalid organisation ID'},{status:400});
 try{return Response.json(await listAcademicYearRollovers(data.user.id,organisationId));}
 catch(error){if(error instanceof AcademicYearRolloverError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to load academic-year rollover plans'},{status:500});}
}

export async function POST(request:Request,context:{params:Promise<{organisationId:string}>}) {
 const {data}=await auth.getSession();
 if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId}=await context.params;
 if(!uuidPattern.test(organisationId))return Response.json({error:'Invalid organisation ID'},{status:400});
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:'A valid JSON body is required'},{status:400});}
 if(!body||typeof body!=='object'||!('fromAcademicYear' in body)||typeof body.fromAcademicYear!=='number'||!('effectiveAt' in body)||typeof body.effectiveAt!=='string')return Response.json({error:'Source academic year and effective date are required'},{status:400});
 try{return Response.json(await createAcademicYearRollover(data.user.id,organisationId,body.fromAcademicYear,body.effectiveAt),{status:201});}
 catch(error){if(error instanceof AcademicYearRolloverError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to create academic-year rollover'},{status:409});}
}
