import { processFinalEventQueue } from './_shared/automation-engine-final.mts';
export default async(req:Request)=>{try{await req.json().catch(()=>({}));const result=await processFinalEventQueue(75);console.log('VMS event automation cycle',JSON.stringify(result))}catch(error:any){console.error('VMS event automation runner failed',error?.message||error)}};
export const config={schedule:'* * * * *'};
