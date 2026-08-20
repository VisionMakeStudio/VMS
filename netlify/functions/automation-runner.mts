import { runFinalAutomationCycle } from './_shared/automation-engine-final.mts';
export default async(req:Request)=>{try{await req.json().catch(()=>({}));const result=await runFinalAutomationCycle('scheduled');console.log('VMS automation cycle',JSON.stringify(result))}catch(error:any){console.error('VMS automation runner failed',error?.message||error)}};
export const config={schedule:'@hourly'};
