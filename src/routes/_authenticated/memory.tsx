import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { deleteMemory, importDriveFile, ingestItem, isAdmin, listMemory } from "@/lib/brain.functions";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "حافظه | مغز دانشی MKA" },
      { name: "description", content: "سندها و تصاویر خوانده‌شده، خلاصه، استدلال و مواد قانونی مرتبط." },
      { property: "og:title", content: "حافظه | مغز دانشی MKA" },
      { property: "og:description", content: "سندها و تصاویر خوانده‌شده، خلاصه، استدلال و مواد قانونی مرتبط." },
    ],
  }),
  component: MemoryPage,
});

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function MemoryPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMemory);
  const ingest = useServerFn(ingestItem);
  const del = useServerFn(deleteMemory);
  const drive = useServerFn(importDriveFile);
  const admin = useServerFn(isAdmin);
  const items = useQuery({ queryKey: ["memory"], queryFn: () => list() });
  const adminQ = useQuery({ queryKey: ["admin"], queryFn: () => admin() });
  const [text, setText] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

  const done = (r: { links: number }) => {
    toast.success(`خوانده و در حافظه ثبت شد (${r.links} ارتباط با منابع قبلی).`);
    qc.invalidateQueries({ queryKey: ["memory"] });
  };
  const fail = (e: any) => toast.error(e?.message ?? "خطا");

  const upload = useMutation({
    mutationFn: async (file: File) => ingest({ data: { title: file.name, mime: file.type, base64: await toBase64(file) } }),
    onSuccess: done,
    onError: fail,
  });
  const addText = useMutation({
    mutationFn: () => ingest({ data: { title: text.slice(0, 60), mime: "text/plain", text } }),
    onSuccess: (r) => {
      setText("");
      done(r);
    },
    onError: fail,
  });
  const addDrive = useMutation({
    mutationFn: () => drive({ data: { url: driveUrl } }),
    onSuccess: (r) => {
      setDriveUrl("");
      done(r);
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
    onError: fail,
  });
  const busy = upload.isPending || addText.isPending || addDrive.isPending;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-semibold">بارگذاری تصویر یا PDF</h2>
            <p className="mb-3 text-sm text-muted-foreground">عکس یا اسکن بخشنامه، رأی یا لایحه؛ یک‌بار خوانده و برای همیشه به خاطر سپرده می‌شود.</p>
            <Input
              type="file"
              accept="image/*,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-semibold">افزودن متن</h2>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="متن مطلب حقوقی…" />
            <Button className="mt-2 w-full" disabled={busy || text.trim().length < 20} onClick={() => addText.mutate()}>
              خواندن و ذخیره
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-semibold">از گوگل‌درایو</h2>
            {adminQ.data?.admin ? (
              <>
                <Input dir="ltr" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" />
                <Button className="mt-2 w-full" disabled={busy || driveUrl.length < 10} onClick={() => addDrive.mutate()}>
                  وارد کردن
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">این بخش فقط برای مدیر فعال است.</p>
            )}
          </div>
        </section>

        {busy && <p className="rounded-md bg-accent/40 p-3 text-sm">در حال خواندن و استدلال… ممکن است یک دقیقه طول بکشد.</p>}

        <section className="space-y-4">
          <h2 className="text-lg font-bold">حافظه ({items.data?.length ?? 0})</h2>
          {items.isLoading && <p className="text-muted-foreground">در حال بارگذاری…</p>}
          {items.data?.length === 0 && <p className="text-muted-foreground">هنوز چیزی ثبت نشده است.</p>}
          {items.data?.map((m: any) => (
            <article key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{m.title}</h3>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(m.id)}>
                  حذف
                </Button>
              </div>
              <p className="mt-2 text-sm leading-7">{m.summary}</p>
              {m.reasoning && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-primary">استدلال</summary>
                  <p className="mt-1 leading-7 text-muted-foreground">{m.reasoning}</p>
                </details>
              )}
              {m.key_points?.length > 0 && (
                <ul className="mt-2 list-disc pr-5 text-sm">
                  {m.key_points.map((k: string, i: number) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.articles?.map((a: string) => (
                  <Badge key={a} variant="secondary">
                    {a}
                  </Badge>
                ))}
                {m.memory_links?.length > 0 && <Badge variant="outline">{m.memory_links.length} ارتباط</Badge>}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
