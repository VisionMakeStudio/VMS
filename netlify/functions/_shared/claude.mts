/* Shared Anthropic (Claude) helper for VMS audit tools.
   The API key lives only in Netlify environment variables (ANTHROPIC_API_KEY). */

type Row = Record<string, any>;

const clean = (v: any, max = 1000) => String(v ?? "").trim().slice(0, max);

export function envValue(name: string): string {
  const netlifyEnv = (globalThis as any)?.Netlify?.env;
  const processEnv = ((globalThis as any)?.process?.env || {}) as Record<string, string | undefined>;
  return clean(netlifyEnv?.get?.(name) ?? processEnv[name], 500);
}

export const hasClaudeKey = () => !!envValue("ANTHROPIC_API_KEY");

/** Model comes from ANTHROPIC_AUDIT_MODEL when it looks like a Claude model id. */
export function claudeModel(): string {
  const requested = envValue("ANTHROPIC_AUDIT_MODEL");
  return /^claude-[a-z0-9._-]+$/i.test(requested) ? requested : "claude-sonnet-5-5";
}

/** Pull the most complete JSON object out of a model reply (handles ``` fences and chatter). */
export function extractJson(text: string, mustHave?: string): Row | null {
  const src = String(text || "");
  const candidates: string[] = [];
  const fence = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  candidates.push(src);
  let best: Row | null = null;
  for (const chunk of candidates) {
    for (let start = chunk.indexOf("{"); start !== -1; start = chunk.indexOf("{", start + 1)) {
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < chunk.length; i++) {
        const ch = chunk[i];
        if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            try {
              const obj = JSON.parse(chunk.slice(start, i + 1));
              if (obj && typeof obj === "object" && (!mustHave || mustHave in obj)) {
                if (!best || JSON.stringify(obj).length > JSON.stringify(best).length) best = obj;
              }
            } catch { /* keep scanning */ }
            break;
          }
        }
      }
    }
    if (best) return best;
  }
  return best;
}

export interface ClaudeResult {
  text: string;
  model: string;
  responseId: string;
  usage: Row;
  sources: Array<{ url: string; title: string; supports: string }>;
}

/** One Claude request, optionally with the web search tool. Handles long searches that pause the turn. */
export async function claudeMessage(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
  webSearchUses?: number;
}): Promise<ClaudeResult> {
  const key = envValue("ANTHROPIC_API_KEY");
  if (!key) {
    throw Object.assign(
      new Error("Audit AI is not connected yet. Add ANTHROPIC_API_KEY in Netlify first."),
      { status: 503, code: "claude_not_configured" },
    );
  }
  const model = claudeModel();
  const messages: Row[] = [{ role: "user", content: opts.user }];
  const tools = opts.webSearchUses ? [{ type: "web_search_20250305", name: "web_search", max_uses: opts.webSearchUses }] : undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 42000);
  const texts: string[] = [];
  const sources = new Map<string, { url: string; title: string; supports: string }>();
  let last: Row = {};
  try {
    for (let turn = 0; turn < 3; turn++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 6500, system: opts.system, messages, ...(tools ? { tools } : {}) }),
      });
      const raw: Row = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(
          new Error(clean(raw?.error?.message, 500) || `Claude request failed (${res.status}).`),
          { status: 502, code: "claude_request_failed" },
        );
      }
      last = raw;
      const blocks: Row[] = Array.isArray(raw.content) ? raw.content : [];
      for (const b of blocks) {
        if (b?.type === "text" && typeof b.text === "string") {
          texts.push(b.text);
          for (const c of Array.isArray(b.citations) ? b.citations : []) {
            const url = clean(c?.url, 1000);
            if (/^https?:\/\//i.test(url) && !sources.has(url)) {
              sources.set(url, { url, title: clean(c?.title, 200) || new URL(url).hostname, supports: "Public web evidence used by Audit AI" });
            }
          }
        } else if (b?.type === "web_search_tool_result" && Array.isArray(b.content)) {
          for (const r of b.content) {
            const url = clean(r?.url, 1000);
            if (/^https?:\/\//i.test(url) && !sources.has(url)) {
              sources.set(url, { url, title: clean(r?.title, 200) || new URL(url).hostname, supports: "Public web evidence used by Audit AI" });
            }
          }
        }
      }
      if (raw.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: blocks }); continue; }
      break;
    }
  } finally {
    clearTimeout(timer);
  }
  return {
    text: texts.join(""),
    model,
    responseId: clean(last.id, 160),
    usage: last.usage || {},
    sources: [...sources.values()].slice(0, 12),
  };
}
