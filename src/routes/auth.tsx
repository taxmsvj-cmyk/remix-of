import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ورود | مغز دانشی MKA" },
      { name: "description", content: "ورود یا ثبت‌نام در مغز دانشی کتابخانه قوانین مالیاتی." },
      { property: "og:title", content: "ورود | مغز دانشی MKA" },
      { property: "og:description", content: "ورود یا ثبت‌نام در مغز دانشی کتابخانه قوانین مالیاتی." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/memory" });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        toast.success("ایمیل تأیید ارسال شد؛ لینک داخل ایمیل را باز کنید.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function google(): Promise<void> {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      toast.error(String(r.error.message ?? r.error));
      return;
    }
    if (r.redirected) return;
    navigate({ to: "/memory" });
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto mt-12 max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-bold">{mode === "in" ? "ورود" : "ثبت‌نام"}</h1>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">رمز عبور</Label>
            <Input id="pw" type="password" dir="ltr" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy}>
            {mode === "in" ? "ورود" : "ساخت حساب"}
          </Button>
        </form>
        <Button variant="outline" className="mt-3 w-full" onClick={google}>
          ادامه با گوگل
        </Button>
        <button className="mt-4 w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "حساب ندارید؟ ثبت‌نام" : "حساب دارید؟ ورود"}
        </button>
      </main>
    </div>
  );
}
