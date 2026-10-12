import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مغز دانشی MKA | حافظه و استدلال قوانین مالیاتی" },
      { name: "description", content: "هر سند را یک‌بار بخوانید؛ خلاصه، استدلال و ارتباط با مواد قانونی برای پاسخ‌های بعدی ذخیره می‌شود." },
      { property: "og:title", content: "مغز دانشی MKA" },
      { property: "og:description", content: "حافظه و استدلال حقوقی برای کتابخانه قوانین مالیاتی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold text-primary">MKA-Core · مغز دانشی کتابخانه قوانین</p>
        <h1 className="text-4xl font-black leading-tight md:text-5xl">یک‌بار بخوان، همیشه به خاطر بسپار.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          عکس، اسکن یا PDF بخشنامه و رأی را بارگذاری کنید. متن خوانده می‌شود، استدلال حقوقی و مواد قانونی آن استخراج و به منابع قبلی وصل
          می‌شود تا پاسخ‌های بعدی سریع، دقیق و مستند باشند.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link to="/memory">شروع</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/ask">پرسش</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["خواندن تصویر", "متن فارسی عکس و اسکن‌ها دقیق استخراج می‌شود."],
            ["حافظه مستدل", "خلاصه، استدلال و مواد قانونی هر سند ذخیره می‌شود."],
            ["پاسخ با منبع", "پاسخ فقط از حافظه و بخشنامه‌ها، همراه شماره منبع."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-bold">{t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
