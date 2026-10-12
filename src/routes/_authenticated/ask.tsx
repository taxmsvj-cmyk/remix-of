import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { askBrain } from "@/lib/brain.functions";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "پرسش | مغز دانشی MKA" },
      { name: "description", content: "پرسش مالیاتی با پاسخ مستند به حافظه و بخشنامه‌ها." },
      { property: "og:title", content: "پرسش | مغز دانشی MKA" },
      { property: "og:description", content: "پرسش مالیاتی با پاسخ مستند به حافظه و بخشنامه‌ها." },
    ],
  }),
  component: AskPage,
});

const STATUS: Record<string, string> = {
  SUCCESS: "پاسخ مستند",
  INSUFFICIENT_DATA: "اطلاعات کافی نیست",
  CLARIFICATION_REQUIRED: "نیاز به توضیح بیشتر",
  ERROR: "خطا",
};

function AskPage() {
  const ask = useServerFn(askBrain);
  const [q, setQ] = useState("");
  const m = useMutation({ mutationFn: () => ask({ data: { question: q } }) });
  const r = m.data;
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">پرسش از مغز دانشی</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-2"
        >
          <Textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="مثلاً: جریمه کتمان درآمد طبق ماده ۱۹۲ چگونه محاسبه می‌شود؟" />
          <Button disabled={m.isPending || q.trim().length < 4}>{m.isPending ? "در حال استدلال…" : "بپرس"}</Button>
        </form>
        {r && (
          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <Badge variant={r.status === "SUCCESS" ? "default" : "secondary"}>{STATUS[r.status]}</Badge>
            <p className="whitespace-pre-wrap leading-8">{r.answer}</p>
            {r.citations.length > 0 && (
              <div>
                <h2 className="mb-2 font-semibold">منابع</h2>
                <ol className="list-decimal space-y-1 pr-5 text-sm">
                  {r.citations.map((c) => (
                    <li key={c.source_id}>
                      <span className="text-muted-foreground">{c.source_type === "memory" ? "حافظه: " : "بخشنامه: "}</span>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-primary underline">
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="text-xs text-muted-foreground" dir="ltr">
              trace: {r.trace_id}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
