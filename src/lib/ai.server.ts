// Server-only: Lovable AI Gateway (Responses API) with streamed consumption.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
export const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Streams a Responses call and returns the final output text. */
export async function runResponses(opts: {
  instructions: string;
  content: Record<string, unknown>[];
  schema?: { name: string; schema: Record<string, unknown> };
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError(401, "کلید هوش مصنوعی تنظیم نشده است.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: opts.instructions,
      input: [{ role: "user", content: opts.content }],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      ...(opts.schema
        ? { text: { format: { type: "json_schema", name: opts.schema.name, strict: true, schema: opts.schema.schema } } }
        : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error(`AI gateway error [${res.status}]: ${body}`);
    let msg = "خطا در سرویس هوش مصنوعی.";
    if (res.status === 402) msg = "اعتبار هوش مصنوعی تمام شده است.";
    if (res.status === 429) msg = "درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.";
    try {
      const j = JSON.parse(body);
      if (j?.message && (res.status === 402 || res.status === 403)) msg = j.message;
    } catch {}
    throw new AiError(res.status, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const evt = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = evt.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let j: any;
      try {
        j = JSON.parse(data);
      } catch {
        continue;
      }
      if (j.type === "response.output_text.delta") text += j.delta ?? "";
      else if (j.type === "response.failed" || j.type === "error") {
        console.error("AI stream error", data);
        throw new AiError(500, "پاسخ هوش مصنوعی ناقص ماند.");
      }
    }
  }
  if (!text.trim()) throw new AiError(500, "هوش مصنوعی پاسخی برنگرداند.");
  return text;
}
