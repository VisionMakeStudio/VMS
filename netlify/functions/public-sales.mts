import { getPublicSalesData } from './_shared/public-sales.mts';

export default async(req:Request)=>{
  if(req.method!=='GET')return Response.json({error:'Method not allowed.'},{status:405});
  try{
    const data=await getPublicSalesData();
    return Response.json(data,{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
  }catch(e:any){
    return Response.json({error:e?.message||'Sales information is temporarily unavailable.'},{status:Number(e?.status)||500});
  }
};
export const config={path:'/api/public-sales'};
