import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin } from "./_shared/auth.mts";

const categories = ["website", "google", "reviews", "systems"] as const;

type RubricItem = [string, string, number, string[], Array<[string, number | null]>];

function outputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function safeRubrics(raw: any) {
  const out: Record<string, RubricItem[]> = {};
  for (const cat of categories) out[cat] = Array.isArray(raw?.[cat]) ? raw[cat] : [];
  return out;
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    await requireAdmin(req);
    const apiKey = Netlify.env.get("OPENAI_API_KEY");
    if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY is not configured in Netlify."), { status: 503 });

    const body: any = await req.json();
    const rubrics = safeRubrics(body.rubrics);
    const business = {
      businessName: String(body.businessName || "").trim(),
      industry: String(body.industry || "").trim(),
      websiteUrl: String(body.websiteUrl || "").trim(),
      googleUrl: String(body.googleUrl || "").trim(),
      overviewNotes: String(body.overviewNotes || "").trim(),
    };
    if (!business.businessName && !business.websiteUrl && !business.googleUrl) {
      return Response.json({ error: "Add a business name, website URL, or Google listing before running the audit." }, { status: 400 });
    }

    const schema: any = {
      type: "object",
      additionalProperties: false,
      properties: { categories: { type: "object", additionalProperties: false, properties: {}, required: [...categories] } },
      required: ["categories"],
    };
    for (const cat of categories) {
      schema.properties.categories.properties[cat] = {
        type: "object",
        additionalProperties: false,
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          evidence: { type: "array", items: { type: "string" } },
          selections: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["score", "reason", "confidence", "evidence", "selections"],
      };
    }

    const prompt = `You are the Vision Make Studio (VMS) Audit Assistant performing a preliminary public-facing business audit for a human VMS reviewer.

RESEARCH RULES
- Use web search to inspect the supplied website, supplied Google/business listing URL, and other clearly matching public business pages when available.
- Verify public facts before scoring them. Never invent ratings, review counts, hours, features, booking systems, automation, or internal business processes.
- If an item depends on private/internal information that cannot be verified publicly, choose the exact "N/A" rubric option when it exists. If N/A does not exist, choose the most defensible conservative option and explain the uncertainty.
- Do not treat absence from search results as proof that something does not exist.
- Keep evidence short and factual. Include the page/domain or public source in each evidence string when useful.
- The result is only a suggestion. A VMS human reviewer decides whether to accept or edit it.

SCORING RULES
- For every category, select exactly one of the exact option labels provided for every rubric item.
- Never create a new option label.
- The category score should reflect those selections and the VMS rubric, from 0 to 100.
- Confidence is 0-100 based on how much reliable public evidence was available.

BUSINESS
${JSON.stringify(business, null, 2)}

VMS RUBRICS
${JSON.stringify(rubrics, null, 2)}

Return only the requested structured result.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Netlify.env.get("OPENAI_AUDIT_MODEL") || "gpt-5.6-luna",
        store: false,
        tools: [{ type: "web_search" }],
        input: prompt,
        text: { format: { type: "json_schema", name: "vms_audit", strict: false, schema } },
      }),
    });
    const data: any = await response.json();
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || "OpenAI audit request failed."), { status: 502 });
    const text = outputText(data);
    if (!text) throw Object.assign(new Error("The AI audit returned no structured result."), { status: 502 });
    const parsed = JSON.parse(text);

    // Compatibility layer for the approved Audit UI: both its newer category flow and older section flow work.
    const sections: Record<string, any> = {};
    for (const cat of categories) {
      const result = parsed?.categories?.[cat] || {};
      const items = (rubrics[cat] || []).map((item: RubricItem) => {
        const [id, , , , options] = item;
        const label = result?.selections?.[id];
        const match = (options || []).find((o: any) => o?.[0] === label);
        return { id, label: match?.[0] || "N/A", points: typeof match?.[1] === "number" ? match[1] : 0 };
      });
      sections[cat] = { score: Number(result.score) || 0, summary: result.reason || "", confidence: Number(result.confidence) || 0, evidence: result.evidence || [], items };
    }
    return Response.json({ ...parsed, sections, researched: true });
  } catch (error) { return jsonError(error); }
};

export const config: Config = { path: "/api/ai-audit" };
