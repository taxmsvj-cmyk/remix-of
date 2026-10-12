import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 15 * 1024 * 1024;

const ingestInput = z.object({
  title: z.string().min(1).max(300),
  mime: z.string().max(100),
  base64: z.string().optional(),
  text: z.string().max(200000).optional(),
});

function partFor(mime: string, base64?: string, text?: string, name = "file.pdf") {
  if (text) return { type: "input_text", text };
  if (!base64) throw new Error("فایلی ارسال نشد.");
  if (base64.length * 0.75 > MAX_BYTES) throw new Error("حجم فایل بیش از ۱۵ مگابایت است.");
  if (mime.startsWith("image/")) return { type: "input_image", image_url: `data:${mime};base64,${base64}` };
  if (mime === "application/pdf") return { type: "input_file", filename: name, file_data: `data:application/pdf;base64,${base64}` };
  throw new Error("فقط تصویر، PDF یا متن پشتیبانی می‌شود.");
}

async function saveMemory(
  ctx: { supabase: any; userId: string },
  part: Record<string, unknown>,
  title: string,
  sourceType: string,
  sourceRef: string | null,
) {
  const { extractKnowledge, linkMemory } = await import("./brain.server");
  const ex = await extractKnowledge(part, title);
  const { data, error } = await ctx.supabase
    .from("memory_items")
    .insert({
      user_id: ctx.userId,
      title: ex.title || title,
      source_type: sourceType,
      source_ref: sourceRef,
      extracted_text: ex.extracted_text,
      summary: ex.summary,
      reasoning: ex.reasoning,
      key_points: ex.key_points,
      articles: ex.articles,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const links = await linkMemory(ctx.supabase, ctx.userId, data.id, ex);
  return { id: data.id as string, links };
}

export const ingestItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ingestInput.parse(d))
  .handler(async ({ data, context }) => {
    const part = partFor(data.mime, data.base64, data.text, data.title);
    return saveMemory(context, part, data.title, data.text ? "text" : "upload", null);
  });

export const listMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memory_items")
      .select("id,title,source_type,source_ref,summary,reasoning,key_points,articles,created_at,memory_links(target_type,target_ref)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("memory_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const askBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { orchestrate } = await import("./brain.server");
    try {
      return await orchestrate(context.supabase, data.question);
    } catch (e: any) {
      return { status: "ERROR" as const, answer: e?.message ?? "خطا", citations: [], actions: [], trace_id: crypto.randomUUID() };
    }
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

/** Drive import uses the owner's linked Drive, so only admins may use it. */
export const importDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().min(10).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("فقط مدیر می‌تواند از گوگل‌درایو وارد کند.");
    const m = data.url.match(/\/d\/([\w-]+)/) ?? data.url.match(/[?&]id=([\w-]+)/) ?? data.url.match(/^([\w-]{20,})$/);
    if (!m) throw new Error("لینک گوگل‌درایو معتبر نیست.");
    const id = m[1];
    const G = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
    const H = {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["GOOGLE_DRIVE_API_KEY"] ?? "",
    };
    const metaRes = await fetch(`${G}/files/${id}?fields=id,name,mimeType,size,webViewLink&supportsAllDrives=true`, { headers: H });
    if (!metaRes.ok) throw new Error(`خواندن فایل از درایو ناموفق بود [${metaRes.status}]`);
    const meta = (await metaRes.json()) as { name: string; mimeType: string; webViewLink?: string };
    let url = `${G}/files/${id}?alt=media&supportsAllDrives=true`;
    let mime = meta.mimeType;
    if (mime === "application/vnd.google-apps.document") {
      url = `${G}/files/${id}/export?mimeType=text/plain`;
      mime = "text/plain";
    } else if (mime === "application/vnd.google-apps.spreadsheet") {
      url = `${G}/files/${id}/export?mimeType=text/csv`;
      mime = "text/plain";
    }
    const fr = await fetch(url, { headers: H });
    if (!fr.ok) throw new Error(`دانلود فایل از درایو ناموفق بود [${fr.status}]`);
    const buf = new Uint8Array(await fr.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("حجم فایل بیش از ۱۵ مگابایت است.");
    let part: Record<string, unknown>;
    if (mime.startsWith("text/")) part = { type: "input_text", text: new TextDecoder().decode(buf).slice(0, 200000) };
    else {
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      part = partFor(mime, btoa(bin), undefined, meta.name);
    }
    return saveMemory(context, part, meta.name, "drive", meta.webViewLink ?? data.url);
  });
