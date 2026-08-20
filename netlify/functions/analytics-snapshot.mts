import { saveDailySnapshot } from './_shared/analytics.mts';
export default async()=>{try{const snapshot=await saveDailySnapshot();console.log('VMS analytics snapshot',JSON.stringify({date:snapshot?.snapshot_date}))}catch(error:any){console.error('VMS analytics snapshot failed',error?.message||error)}};
// 06:15 UTC daily (02:15 EDT / 01:15 EST depending on daylight saving time).
export const config={schedule:'15 6 * * *'};
