import { runAutomationCycle } from './_shared/automations.mts';

export default async(req:Request)=>{
  try{await req.json().catch(()=>({}));const result=await runAutomationCycle('scheduled');console.log('VMS automation cycle',JSON.stringify(result));}
  catch(error:any){console.error('VMS automation runner failed',error?.message||error)}
};

// Keep this untyped because the repository's local Config shim currently exposes routing fields only.
// Netlify supports the schedule property for TypeScript/JavaScript scheduled functions.
export const config={schedule:'@hourly'};
