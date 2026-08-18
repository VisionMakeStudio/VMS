import type { Config, Context } from "@netlify/functions";

const rubricShape = ["website","google","reviews","systems"];

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) return Response.json({ error: "OPENAI_API_KEY is not configured in Netlify." }, { status: 503 });
  try {
    const body = await req.json();
    const prompt = `You are the Vision Make Studio audit assistant. Analyze only the information supplied. Do not invent facts you cannot verify. For each category (website, google, reviews, systems), return a preliminary 0-100 score, a concise reason, and a selection label for each rubric item using only one of that item's exact option labels. This is a suggestion for VMS to review, not an automatic final score.\n\nBusiness data:\n${JSON.stringify({businessName:body.businessName,industry:body.industry,websiteUrl:body.websiteUrl,overviewNotes:body.overviewNotes})}\n\nRubrics:\n${JSON.stringify(body.rubrics)}`;
    const schema:any={type:"object",additionalProperties:false,properties:{categories:{type:"object",additionalProperties:false,properties:{},required:rubricShape}},required:["categories"]};
    for(const cat of rubricShape){schema.properties.categories.properties[cat]={type:"object",additionalProperties:false,properties:{score:{type:"integer",minimum:0,maximum:100},reason:{type:"string"},selections:{type:"object",additionalProperties:{type:"string"}}},required:["score","reason","selections"]};}
    const response = await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:Netlify.env.get("OPENAI_AUDIT_MODEL")||"gpt-5.6-luna",store:false,input:prompt,text:{format:{type:"json_schema",name:"vms_audit",strict:false,schema}}})});
    const data:any=await response.json();
    if(!response.ok) return Response.json({error:data?.error?.message||"OpenAI request failed"},{status:502});
    const text=data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
    if(!text) return Response.json({error:"The AI audit returned no structured result."},{status:502});
    return Response.json(JSON.parse(text));
  } catch (error:any) { return Response.json({ error: error?.message || "AI audit failed" }, { status: 500 }); }
};
export const config: Config = { path: "/api/ai-audit" };
