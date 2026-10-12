import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { runResponses } from "./ai.server";
import type { Citation, OrchestrateResponse } from "./contract";

type Db = SupabaseClient<Database>;

const EXTRACT_SCHEMA = {
  name: "legal_memory",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "extracted_text", "summary", "reasoning", "key_points", "articles"],
    properties: {
      title: { type: "string" },
      extracted_text: { type: "string" },
      summary: { type: "string" },
      reasoning: { type: "string" },
      key_points: { type: "array", items: { type: "string" } },
      articles: { type: "array", items: { type: "string" } },
    },
  },
};

export type Extracted = {
  title: string;
  extracted_text: string;
  summary: string;
  reasoning: string;
  key_points: string[];
  articles: string[];
};

/** Reads an item once and extracts legal knowledge from it. */
export async function extractKnowledge(part: Record<string, unknown>, hint: string): Promise<Extracted> {
  const out = await runResponses({
    instructions:
      "تو تحلیلگر حقوقی مالیاتی ایران هستی. سند را کامل بخوان. متن فارسی آن را دقیق استخراج کن (برای تصویر، OCR کامل). " +
      "سپس عنوان کوتاه، خلاصه، استدلال حقوقی (چرا و بر چه مبنایی)، نکات کلیدی و فهرست مواد قانونی ذکرشده را بده. " +
      "مواد را به شکل «ماده ۱۹۲ ق.م.م» بنویس. چیزی از خودت نساز؛ اگر نامعلوم است بگو نامعلوم.",
    content: [{ type: "input_text", text: `عنوان پیشنهادی: ${hint}` }, part],
    schema: EXTRACT_SCHEMA,
  });
  return JSON.parse(out) as Extracted;
}

function toQuery(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12);
  return words.join(" or ");
}

/** Links a memory item to related circulars by its referenced articles. */
export async function linkMemory(db: Db, userId: string, memoryId: string, ex: Extracted) {
  const q = toQuery([...ex.articles, ex.title].join(" "));
  if (!q) return 0;
  const { data } = await db.rpc("search_knowledge", { q, lim: 5 });
  const rows = (data ?? []).filter((r) => !(r.kind === "memory" && r.ref_id === memoryId));
  if (!rows.length) return 0;
  await db.from("memory_links").insert(
    rows.map((r) => ({
      user_id: userId,
      memory_id: memoryId,
      target_type: r.kind,
      target_ref: r.ref_id,
      relation: "مرتبط",
    })),
  );
  return rows.length;
}

/** MKA-Core orchestrate: answer only from stored knowledge, with citations. */
export async function orchestrate(db: Db, question: string): Promise<OrchestrateResponse> {
  const trace_id = crypto.randomUUID();
  const q = question.trim();
  if (q.length < 4) {
    return { status: "CLARIFICATION_REQUIRED", answer: "لطفاً پرسش را کامل‌تر بنویسید.", citations: [], actions: [], trace_id };
  }
  const { data, error } = await db.rpc("search_knowledge", { q: toQuery(q), lim: 6 });
  if (error) {
    console.error(error);
    return { status: "ERROR", answer: "جست‌وجو انجام نشد.", citations: [], actions: [], trace_id };
  }
  const rows = data ?? [];
  if (!rows.length) {
    return {
      status: "INSUFFICIENT_DATA",
      answer: "در حافظه و کتابخانه مطلبی مرتبط با این پرسش پیدا نشد.",
      citations: [],
      actions: [{ type: "ingest", label: "افزودن سند مرتبط به حافظه" }],
      trace_id,
    };
  }
  const sources = rows.map((r, i) => `[${i + 1}] (${r.kind === "memory" ? "حافظه" : "بخشنامه"}) ${r.title}\n${r.snippet}`).join("\n\n");
  const answer = await runResponses({
    instructions:
      "فقط بر اساس منابع داده‌شده پاسخ بده و پس از هر ادعا شماره منبع را مثل [۱] بیاور. " +
      "اگر منابع برای پاسخ کافی نیست، دقیقاً بنویس: INSUFFICIENT_DATA. پاسخ فارسی، دقیق و مستدل باشد.",
    content: [{ type: "input_text", text: `منابع:\n${sources}\n\nپرسش: ${q}` }],
  });
  if (answer.trim().startsWith("INSUFFICIENT_DATA")) {
    return { status: "INSUFFICIENT_DATA", answer: "منابع موجود برای پاسخ مطمئن کافی نیست.", citations: [], actions: [], trace_id };
  }
  const citations: Citation[] = rows.map((r) => ({
    source_type: r.kind as Citation["source_type"],
    source_id: r.ref_id,
    title: r.title,
    url: r.url,
  }));
  return { status: "SUCCESS", answer, citations, actions: [], trace_id };
}
