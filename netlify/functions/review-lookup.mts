import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin } from "./_shared/auth.mts";

function outputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const item of data?.output || []) for (const c of item?.content || []) if (c?.type === "output_text") return c.text || "";
  return "";
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    await requireAdmin(req);
    const apiKey = Netlify.env.get("OPENAI_API_KEY");
    if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY is not configured in Netlify."), { status: 503 });
    const body: any = await req.json();
    const url = String(body.url || "").trim();
    if (!url) return Response.json({ error: "Listing URL is required." }, { status: 400 });
    const schema = { type: "object", additionalProperties: false, properties: {
      rating: { anyOf: [{ type: "number", minimum: 0, maximum: 5 }, { type: "null" }] },
      reviewCount: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
      matchedName: { type: "string" }, sourceName: { type: "string" }, sourceUrl: { type: "string" }, confidence: { type: "integer", minimum: 0, maximum: 100 }
    }, required: ["rating","reviewCount","matchedName","sourceName","sourceUrl","confidence"] };
    const prompt = `Verify the current public review rating and review count for this business listing. Use web search and the supplied URL. Do not guess. If either value cannot be confidently verified, return null for it.\nPlatform: ${String(body.platform||'')}\nListing URL: ${url}\nBusiness name: ${String(body.businessName||'')}\nIndustry: ${String(body.industry||'')}`;
    const requestedModel=String(Netlify.env.get("OPENAI_AUDIT_MODEL")||"").trim();
    const supportedModels=new Set(["gpt-4o-mini","gpt-4.1-mini","gpt-4.1","gpt-5-mini","gpt-5"]);
    const model=supportedModels.has(requestedModel)?requestedModel:"gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, store: false, tools: [{ type: "web_search" }], input: prompt, text: { format: { type: "json_schema", name: "vms_review_lookup", strict: false, schema } } }) });
    const data: any = await response.json();
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || "Review lookup failed."), { status: 502 });
    const text = outputText(data); if (!text) throw Object.assign(new Error("No review data was returned."), { status: 502 });
    const result = JSON.parse(text);
    return Response.json({ ok: result.rating != null || result.reviewCount != null, ...result });
  } catch (error) { return jsonError(error); }
};

export const config: Config = { path: "/api/review-lookup" };
